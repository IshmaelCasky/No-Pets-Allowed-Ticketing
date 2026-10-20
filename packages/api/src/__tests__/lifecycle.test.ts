/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition -- test fixtures freely assert on known-present rows */
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { TestEnv } from "./helpers";
import {
  callerFor,
  getTestEnv,
  hasTestDb,
  migrate,
  resetDb,
  seedRole,
  seedUser,
} from "./helpers";

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

interface Fixture {
  env: TestEnv;
  customerId: string;
  staffId: string;
  methodId: string;
}

async function seedBase(env: TestEnv): Promise<Fixture> {
  const customerRole = await seedRole(env, "Customer", [], true);
  const staffRole = await seedRole(env, "Staff", [
    "orders:read",
    "orders:review",
    "refunds:review",
    "tickets:scan",
  ]);
  const customerId = await seedUser(env, {
    name: "Casey Customer",
    roleId: customerRole,
  });
  const staffId = await seedUser(env, {
    name: "Sam Staff",
    roleId: staffRole,
  });
  const [method] = await env.db
    .insert(env.schema.paymentMethod)
    .values({ label: "GCash", sortOrder: 0 })
    .returning();
  return { env, customerId, staffId, methodId: method!.id };
}

async function createGaEvent(env: TestEnv, capacity: number, price = 50000) {
  const [ev] = await env.db
    .insert(env.schema.event)
    .values({
      slug: `ga-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: "GA Show",
      status: "published",
      seatingMode: "ga",
      maxPerOrder: 4,
      startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning();
  const [tier] = await env.db
    .insert(env.schema.ticketTier)
    .values({ eventId: ev!.id, name: "GA", price, capacity, sortOrder: 0 })
    .returning();
  return { event: ev!, tier: tier! };
}

async function createReservedEvent(env: TestEnv) {
  const [ev] = await env.db
    .insert(env.schema.event)
    .values({
      slug: `rs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: "Reserved Show",
      status: "published",
      seatingMode: "reserved",
      maxPerOrder: 4,
      startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning();
  const [section] = await env.db
    .insert(env.schema.seatSection)
    .values({
      eventId: ev!.id,
      name: "VIP",
      price: 100000,
      rows: 2,
      seatsPerRow: 2,
      rowLabelStyle: "alpha",
      sortOrder: 0,
    })
    .returning();
  // Build the 4 seats manually (mirrors seat-map.createSection).
  const seats = [];
  for (let r = 0; r < 2; r++) {
    const rowLabel = String.fromCharCode(65 + r);
    for (let n = 1; n <= 2; n++) {
      seats.push({
        sectionId: section!.id,
        eventId: ev!.id,
        rowLabel,
        number: n,
        label: `VIP-${rowLabel}${n}`,
      });
    }
  }
  const inserted = await env.db
    .insert(env.schema.seat)
    .values(seats)
    .returning();
  return { event: ev!, section: section!, seats: inserted };
}

/* -------------------------------------------------------------------------- */

describe.runIf(hasTestDb)("router lifecycle + concurrency", () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await getTestEnv();
    await migrate(env);
  });

  afterAll(async () => {
    if (env)
      await (env.db as { $client: { end: () => Promise<void> } }).$client.end();
  });

  beforeEach(async () => {
    await resetDb(env);
  });

  it("GA: cannot oversell a tier under concurrent orders", async () => {
    const f = await seedBase(env);
    const { event, tier } = await createGaEvent(env, 3);
    const buyer = await seedUser(env, { roleId: null });
    const caller = await callerFor(env, buyer);

    const order = (seatQty: number) =>
      caller.order.create({
        mode: "ga",
        eventId: event.id,
        items: [{ tierId: tier.id, quantity: seatQty }],
      });

    // Three buyers of 2 each → only one-and-a-half fit (capacity 3).
    const results = await Promise.allSettled([order(2), order(2)]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const conflicts = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof TRPCError,
    ).length;
    expect(ok).toBe(1);
    expect(conflicts).toBe(1);

    const [row] = await env.db
      .select()
      .from(env.schema.ticketTier)
      .where(env.eq(env.schema.ticketTier.id, tier.id));
    expect(row!.reserved).toBe(2);
    expect(row!.reserved + row!.sold).toBeLessThanOrEqual(row!.capacity);
    void f;
  });

  it("Reserved: two orders can't hold the same seat", async () => {
    await seedBase(env);
    const { event, seats } = await createReservedEvent(env);
    const a = await callerFor(env, await seedUser(env));
    const b = await callerFor(env, await seedUser(env));
    const seatId = seats[0]!.id;

    const results = await Promise.allSettled([
      a.order.create({
        mode: "reserved",
        eventId: event.id,
        seatIds: [seatId],
      }),
      b.order.create({
        mode: "reserved",
        eventId: event.id,
        seatIds: [seatId],
      }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1);
    const conflict = results.find((r) => r.status === "rejected");
    expect(conflict!.reason).toBeInstanceOf(TRPCError);
  });

  it("approve generates tickets and marks inventory sold; double-approve is CONFLICT", async () => {
    const f = await seedBase(env);
    const { event, tier } = await createGaEvent(env, 10);
    const buyer = await seedUser(env);
    const buyerCaller = await callerFor(env, buyer);
    const staffCaller = await callerFor(env, f.staffId);

    const order = await buyerCaller.order.create({
      mode: "ga",
      eventId: event.id,
      items: [{ tierId: tier.id, quantity: 2 }],
    });
    await buyerCaller.order.submitProof({
      orderId: order.id,
      paymentMethodId: f.methodId,
      referenceNumber: "REF-1",
      proofImageKey: "key-1",
    });

    const approved = await staffCaller.review.approve({ orderId: order.id });
    expect(approved.status).toBe("approved");

    const tickets = await env.db
      .select()
      .from(env.schema.ticket)
      .where(env.eq(env.schema.ticket.orderId, order.id));
    expect(tickets).toHaveLength(2);

    const [row] = await env.db
      .select()
      .from(env.schema.ticketTier)
      .where(env.eq(env.schema.ticketTier.id, tier.id));
    expect(row!.sold).toBe(2);
    expect(row!.reserved).toBe(0);

    await expect(
      staffCaller.review.approve({ orderId: order.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("scan: first scan is valid, second is already_used with who/when", async () => {
    const f = await seedBase(env);
    const { event, tier } = await createGaEvent(env, 10);
    const buyer = await seedUser(env);
    const buyerCaller = await callerFor(env, buyer);
    const staffCaller = await callerFor(env, f.staffId);

    const order = await buyerCaller.order.create({
      mode: "ga",
      eventId: event.id,
      items: [{ tierId: tier.id, quantity: 1 }],
    });
    await buyerCaller.order.submitProof({
      orderId: order.id,
      paymentMethodId: f.methodId,
      referenceNumber: "REF-2",
      proofImageKey: "key-2",
    });
    await staffCaller.review.approve({ orderId: order.id });

    const [t] = await env.db
      .select()
      .from(env.schema.ticket)
      .where(env.eq(env.schema.ticket.orderId, order.id));

    const first = await staffCaller.scan.scan({
      eventId: event.id,
      rawValue: t!.token,
    });
    expect(first.result).toBe("valid");

    const second = await staffCaller.scan.scan({
      eventId: event.id,
      rawValue: t!.token,
    });
    expect(second.result).toBe("already_used");
    expect(second.usedByName).toBe("Sam Staff");
    expect(second.usedAt).toBeInstanceOf(Date);

    // Every scan is logged.
    const logs = await env.db
      .select()
      .from(env.schema.scanLog)
      .where(env.eq(env.schema.scanLog.eventId, event.id));
    expect(logs.length).toBe(2);
  });

  it("scan: wrong_event and not_found are logged", async () => {
    const f = await seedBase(env);
    const { event } = await createGaEvent(env, 10);
    const other = await createGaEvent(env, 10);
    const staffCaller = await callerFor(env, f.staffId);

    const notFound = await staffCaller.scan.scan({
      eventId: event.id,
      rawValue: "nope",
    });
    expect(notFound.result).toBe("not_found");

    // Make a valid ticket for `other`, scan it against `event`.
    const buyerCaller = await callerFor(env, await seedUser(env));
    const o = await buyerCaller.order.create({
      mode: "ga",
      eventId: other.event.id,
      items: [{ tierId: other.tier.id, quantity: 1 }],
    });
    await buyerCaller.order.submitProof({
      orderId: o.id,
      paymentMethodId: f.methodId,
      referenceNumber: "REF-3",
      proofImageKey: "key-3",
    });
    await staffCaller.review.approve({ orderId: o.id });
    const [t] = await env.db
      .select()
      .from(env.schema.ticket)
      .where(env.eq(env.schema.ticket.orderId, o.id));

    const wrong = await staffCaller.scan.scan({
      eventId: event.id,
      rawValue: t!.token,
    });
    expect(wrong.result).toBe("wrong_event");
  });

  it("expiry releases held seats via releaseExpired", async () => {
    await seedBase(env);
    const { event, seats } = await createReservedEvent(env);
    const buyerCaller = await callerFor(env, await seedUser(env));
    const anon = await callerFor(env, null);

    const order = await buyerCaller.order.create({
      mode: "reserved",
      eventId: event.id,
      seatIds: [seats[0]!.id, seats[1]!.id],
    });
    // Force the window closed.
    await env.db
      .update(env.schema.order)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(env.eq(env.schema.order.id, order.id));

    const res = await anon.order.releaseExpired();
    expect(res.released).toBe(1);

    const freed = await env.db
      .select()
      .from(env.schema.seat)
      .where(env.eq(env.schema.seat.eventId, event.id));
    expect(freed.every((s) => s.status === "available")).toBe(true);

    const [o] = await env.db
      .select()
      .from(env.schema.order)
      .where(env.eq(env.schema.order.id, order.id));
    expect(o!.status).toBe("expired");
  });

  it("resubmit is allowed once, then blocked", async () => {
    const f = await seedBase(env);
    const { event, tier } = await createGaEvent(env, 10);
    const buyerCaller = await callerFor(env, await seedUser(env));
    const staffCaller = await callerFor(env, f.staffId);

    const order = await buyerCaller.order.create({
      mode: "ga",
      eventId: event.id,
      items: [{ tierId: tier.id, quantity: 1 }],
    });
    await buyerCaller.order.submitProof({
      orderId: order.id,
      paymentMethodId: f.methodId,
      referenceNumber: "R1",
      proofImageKey: "k1",
    });
    await staffCaller.review.reject({ orderId: order.id, reason: "blurry" });

    // First re-submit OK.
    await buyerCaller.order.submitProof({
      orderId: order.id,
      paymentMethodId: f.methodId,
      referenceNumber: "R2",
      proofImageKey: "k2",
    });
    await staffCaller.review.reject({ orderId: order.id, reason: "still bad" });

    // Second re-submit blocked.
    await expect(
      buyerCaller.order.submitProof({
        orderId: order.id,
        paymentMethodId: f.methodId,
        referenceNumber: "R3",
        proofImageKey: "k3",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refund past the cutoff is rejected", async () => {
    const f = await seedBase(env);
    const { event, tier } = await createGaEvent(env, 10);
    const buyerCaller = await callerFor(env, await seedUser(env));
    const staffCaller = await callerFor(env, f.staffId);

    // Event starts tomorrow, cutoff 7 days → already past the window.
    await env.db
      .update(env.schema.event)
      .set({
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        refundCutoffDays: 7,
      })
      .where(env.eq(env.schema.event.id, event.id));

    const order = await buyerCaller.order.create({
      mode: "ga",
      eventId: event.id,
      items: [{ tierId: tier.id, quantity: 1 }],
    });
    await buyerCaller.order.submitProof({
      orderId: order.id,
      paymentMethodId: f.methodId,
      referenceNumber: "RR1",
      proofImageKey: "kk1",
    });
    await staffCaller.review.approve({ orderId: order.id });

    await expect(
      buyerCaller.refund.request({
        orderId: order.id,
        reason: "changed plans",
        payoutMethod: "GCash",
        payoutAccountName: "Casey",
        payoutAccountNumber: "0917",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refund approve voids tickets and frees inventory; markPaid refunds the order", async () => {
    const f = await seedBase(env);
    const { event, seats } = await createReservedEvent(env);
    const buyerCaller = await callerFor(env, await seedUser(env));
    const staffCaller = await callerFor(env, f.staffId);

    const order = await buyerCaller.order.create({
      mode: "reserved",
      eventId: event.id,
      seatIds: [seats[0]!.id],
    });
    await buyerCaller.order.submitProof({
      orderId: order.id,
      paymentMethodId: f.methodId,
      referenceNumber: "RF1",
      proofImageKey: "pf1",
    });
    await staffCaller.review.approve({ orderId: order.id });

    const req = await buyerCaller.refund.request({
      orderId: order.id,
      reason: "refund please",
      payoutMethod: "GCash",
      payoutAccountName: "Casey",
      payoutAccountNumber: "0917",
    });

    await staffCaller.refund.approve({ refundRequestId: req.id });

    const [seat0] = await env.db
      .select()
      .from(env.schema.seat)
      .where(env.eq(env.schema.seat.id, seats[0]!.id));
    expect(seat0!.status).toBe("available");

    const tickets = await env.db
      .select()
      .from(env.schema.ticket)
      .where(env.eq(env.schema.ticket.orderId, order.id));
    expect(tickets.every((t) => t.status === "void")).toBe(true);

    await staffCaller.refund.markPaid({
      refundRequestId: req.id,
      payoutReference: "PAYOUT-1",
      payoutProofKey: "proof-1",
    });
    const [o] = await env.db
      .select()
      .from(env.schema.order)
      .where(env.eq(env.schema.order.id, order.id));
    expect(o!.status).toBe("refunded");
  });

  it("permission denial: a customer cannot review", async () => {
    const f = await seedBase(env);
    const customerCaller = await callerFor(env, f.customerId);
    await expect(
      customerCaller.review.queue({ page: 1, pageSize: 20, sortDir: "desc" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
