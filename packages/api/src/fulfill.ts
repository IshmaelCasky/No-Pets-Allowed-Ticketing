import { TRPCError } from "@trpc/server";

import type { db } from "@npa/db/client";
import type { Order } from "@npa/db/schema";
import { and, eq } from "@npa/db";
import {
  event,
  order,
  orderItem,
  ticket,
  ticketTier,
  user,
} from "@npa/db/schema";

import { generateTicketToken } from "./lib";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface FulfillResult {
  order: Order;
  email: string | null;
  eventTitle: string;
  /** True if the order was already fulfilled (webhook/poll race) — no email. */
  alreadyFulfilled: boolean;
}

/**
 * Mark a paid order approved and generate its tickets. Idempotent: if the order
 * is no longer `pending_payment` (a webhook and a poll can race), it returns the
 * current row with `alreadyFulfilled: true` and does nothing. Call inside a
 * transaction; the caller handles audit + the approval email.
 *
 * Seats `held → sold`, GA tier `reserved → sold`, one ticket per seat / per GA
 * quantity, `paidAt` set.
 */
export async function fulfillPaidOrderTx(
  tx: Tx,
  orderId: string,
  hitpayStatus?: string,
): Promise<FulfillResult> {
  const before = await tx.query.order.findFirst({
    where: eq(order.id, orderId),
  });
  if (!before) throw new TRPCError({ code: "NOT_FOUND" });

  const ev = await tx.query.event.findFirst({
    where: eq(event.id, before.eventId),
    columns: { title: true },
  });
  const buyer = await tx.query.user.findFirst({
    where: eq(user.id, before.userId),
    columns: { name: true, email: true },
  });
  const eventTitle = ev?.title ?? "";

  // Conditional update — only the first caller flips pending_payment → approved.
  const [row] = await tx
    .update(order)
    .set({
      status: "approved",
      paidAt: new Date(),
      hitpayStatus: hitpayStatus ?? before.hitpayStatus,
    })
    .where(and(eq(order.id, orderId), eq(order.status, "pending_payment")))
    .returning();

  if (!row) {
    // Already fulfilled by a concurrent webhook/poll.
    return {
      order: before,
      email: buyer?.email ?? null,
      eventTitle,
      alreadyFulfilled: true,
    };
  }

  const items = await tx
    .select()
    .from(orderItem)
    .where(eq(orderItem.orderId, row.id));

  for (const item of items) {
    // ticket-type `reserved` → `sold`, one ticket per quantity.
    const [tier] = await tx
      .select()
      .from(ticketTier)
      .where(eq(ticketTier.id, item.tierId))
      .for("update");
    if (!tier) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await tx
      .update(ticketTier)
      .set({
        reserved: Math.max(0, tier.reserved - item.quantity),
        sold: tier.sold + item.quantity,
      })
      .where(eq(ticketTier.id, item.tierId));
    for (let i = 0; i < item.quantity; i++) {
      await tx.insert(ticket).values({
        orderId: row.id,
        eventId: row.eventId,
        tierId: item.tierId,
        holderName: buyer?.name ?? null,
        token: generateTicketToken(),
        status: "active",
      });
    }
  }

  return {
    order: row,
    email: buyer?.email ?? null,
    eventTitle,
    alreadyFulfilled: false,
  };
}
