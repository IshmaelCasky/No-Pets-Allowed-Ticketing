import type { Metadata } from "next";

import type { Event, Order, RefundRequest, Ticket } from "@npa/db/schema";

import { getCaller } from "../../(public)/_lib/caller";
import { RefundsClient } from "./_components/refunds-client";

export const metadata: Metadata = { title: "Refunds · No Pets Allowed" };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Approved orders still inside the refund window with no used tickets. */
function buildEligibleOrders(
  orders: Order[],
  refunds: RefundRequest[],
  tickets: Ticket[],
  eventById: Map<string, Event>,
) {
  const refundOrderIds = new Set(refunds.map((r) => r.orderId));
  const usedByOrder = new Set(
    tickets.filter((t) => t.status === "used").map((t) => t.orderId),
  );
  const now = Date.now();

  return orders
    .filter(
      (o) =>
        o.status === "approved" &&
        !refundOrderIds.has(o.id) &&
        !usedByOrder.has(o.id),
    )
    .map((o) => {
      const ev = eventById.get(o.eventId);
      let cutoff: string | null = null;
      let withinWindow = true;
      if (ev?.startsAt) {
        const cutoffMs =
          new Date(ev.startsAt).getTime() - ev.refundCutoffDays * DAY_MS;
        cutoff = new Date(cutoffMs).toISOString();
        withinWindow = now <= cutoffMs;
      }
      return {
        id: o.id,
        code: o.code,
        totalAmount: o.totalAmount,
        eventTitle: ev?.title ?? o.code,
        cutoff,
        withinWindow,
      };
    })
    .filter((o) => o.withinWindow);
}

function buildRefundRows(
  refunds: RefundRequest[],
  orders: Order[],
  eventById: Map<string, Event>,
) {
  return refunds.map((r) => {
    const order = orders.find((o) => o.id === r.orderId);
    return {
      id: r.id,
      orderId: r.orderId,
      status: r.status,
      reason: r.reason,
      payoutMethod: r.payoutMethod,
      payoutAccountName: r.payoutAccountName,
      rejectionReason: r.rejectionReason,
      payoutReference: r.payoutReference,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      orderCode: order?.code ?? r.orderId.slice(0, 8),
      eventTitle: order ? (eventById.get(order.eventId)?.title ?? null) : null,
    };
  });
}

export default async function RefundsPage() {
  const caller = await getCaller();
  const [orders, refunds, tickets, publicEvents] = await Promise.all([
    caller.order.myOrders(),
    caller.refund.myRefunds(),
    caller.ticket.myTickets(),
    caller.event.publicList(),
  ]);

  const eventById = new Map<string, Event>();
  publicEvents.forEach((e) => eventById.set(e.id, e));

  const eligibleOrders = buildEligibleOrders(
    orders,
    refunds,
    tickets,
    eventById,
  );
  const refundRows = buildRefundRows(refunds, orders, eventById);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl">
        Refunds
      </h1>
      <p className="mt-2 text-sm text-[oklch(0.68_0.018_250)]">
        Request a refund on an approved order before the cutoff. We send the
        payout manually and upload the transfer receipt once it’s done.
      </p>
      <RefundsClient eligibleOrders={eligibleOrders} refunds={refundRows} />
    </div>
  );
}
