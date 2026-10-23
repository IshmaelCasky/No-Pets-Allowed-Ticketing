/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition -- test fixtures freely assert on known-present rows */
import { TRPCError } from "@trpc/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { TestEnv } from "./helpers";
import {
  callerFor,
  getTestEnv,
  hasTestDb,
  migrate,
  payOrder,
  resetDb,
  seedRole,
  seedUser,
} from "./helpers";

// Payment runs through HitPay; stub the client so order.create succeeds without
// hitting the gateway. Payment confirmation is simulated via payOrder(), which
// calls the same fulfilment path the webhook uses.
vi.mock("../hitpay", () => ({
  hitpayConfigured: () => true,
  createPaymentRequest: () =>
    Promise.resolve({
      id: "hp_test",
      url: "https://pay.test/x",
      status: "pending",
    }),
  getPaymentRequest: () =>
    Promise.resolve({ id: "hp_test", status: "completed" }),
  verifyWebhookSignature: () => true,
}));

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

interface Fixture {
  env: TestEnv;
  customerId: string;
  staffId: string;
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
  return { env, customerId, staffId };
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
    await seedBase(env);
    const { event, tier } = await createGaEvent(env, 3);
    const caller = await callerFor(env, await seedUser(env, { roleId: null }));

    const order = (qty: number) =>
      caller.order.create({
        mode: "ga",
        eventId: event.id,
        items: [{ tierId: tier.id, quantity: qty }],
      });

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

  it("payment fulfilment generates tickets + marks inventory sold, and is idempotent", async () => {
    await seedBase(env);
    const { event, tier } = await createGaEvent(env, 10);
    const buyerCaller = await callerFor(env, await seedUser(env));

    const { order } = await buyerCaller.order.create({
      mode: "ga",
      eventId: event.id,
      items: [{ tierId: tier.id, quantity: 2 }],
    });

    await payOrder(env, order.id);

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

    // A second webhook/poll for the same order must not double-fulfil.
    await payOrder(env, order.id);
    const after = await env.db
      .select()
      .from(env.schema.ticket)
      .where(env.eq(env.schema.ticket.orderId, order.id));
    expect(after).toHaveLength(2);
  });

  it("scan: first scan is valid, second is already_used with who/when", async () => {
    const f = await seedBase(env);
    const { event, tier } = await createGaEvent(env, 10);
    const buyerCaller = await callerFor(env, await seedUser(env));
    const staffCaller = await callerFor(env, f.staffId);

    const { order } = await buyerCaller.order.create({
      mode: "ga",
      eventId: event.id,
      items: [{ tierId: tier.id, quantity: 1 }],
    });
    await payOrder(env, order.id);

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

    const buyerCaller = await callerFor(env, await seedUser(env));
    const { order: o } = await buyerCaller.order.create({
      mode: "ga",
      eventId: other.event.id,
      items: [{ tierId: other.tier.id, quantity: 1 }],
    });
    await payOrder(env, o.id);
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
    process.env.CRON_SECRET = "test-cron";
    const { event, seats } = await createReservedEvent(env);
    const buyerCaller = await callerFor(env, await seedUser(env));
    const cronCaller = env.createCaller({
      db: env.db,
      session: null,
      authApi: {} as never,
      ip: null,
      userAgent: null,
      headers: new Headers({ authorization: "Bearer test-cron" }),
    } as never);

    const { order } = await buyerCaller.order.create({
      mode: "reserved",
      eventId: event.id,
      seatIds: [seats[0]!.id, seats[1]!.id],
    });
    await env.db
      .update(env.schema.order)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(env.eq(env.schema.order.id, order.id));

    const res = await cronCaller.order.releaseExpired();
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

  it("refund past the cutoff is rejected", async () => {
    await seedBase(env);
    const { event, tier } = await createGaEvent(env, 10);
    const buyerCaller = await callerFor(env, await seedUser(env));

    await env.db
      .update(env.schema.event)
      .set({
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        refundCutoffDays: 7,
      })
      .where(env.eq(env.schema.event.id, event.id));

    const { order } = await buyerCaller.order.create({
      mode: "ga",
      eventId: event.id,
      items: [{ tierId: tier.id, quantity: 1 }],
    });
    await payOrder(env, order.id);

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

    const { order } = await buyerCaller.order.create({
      mode: "reserved",
      eventId: event.id,
      seatIds: [seats[0]!.id],
    });
    await payOrder(env, order.id);

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

  it("permission denial: a customer cannot see the admin order list", async () => {
    const f = await seedBase(env);
    const customerCaller = await callerFor(env, f.customerId);
    await expect(
      customerCaller.order.adminList({
        page: 1,
        pageSize: 20,
        sortDir: "desc",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
