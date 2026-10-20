import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import type { db } from "@npa/db/client";
import type { Order } from "@npa/db/schema";
import { and, asc, count, eq, sql } from "@npa/db";
import {
  event,
  order,
  orderItem,
  seat,
  ticket,
  ticketTier,
  user,
} from "@npa/db/schema";
import {
  approveOrderSchema,
  rejectOrderSchema,
  reviewQueueSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { audit } from "../audit";
import { OrderApprovedEmail, OrderRejectedEmail, sendEmail } from "../emails";
import { generateTicketToken } from "../lib";
import { permissionProcedure } from "../trpc";

/** A review-queue row carries the order plus a duplicate-reference flag. */
export interface ReviewQueueItem {
  order: Order;
  isDuplicateReference: boolean;
}

export const reviewRouter = {
  /** Payment review queue, oldest first. */
  queue: permissionProcedure("orders:review")
    .input(reviewQueueSchema)
    .query(async ({ ctx, input }): Promise<Paginated<ReviewQueueItem>> => {
      const filters = [eq(order.status, "for_review")];
      if (input.eventId) filters.push(eq(order.eventId, input.eventId));
      const where = and(...filters);
      const offset = (input.page - 1) * input.pageSize;

      const [rows, [totalRow]] = await Promise.all([
        ctx.db
          .select()
          .from(order)
          .where(where)
          .orderBy(asc(order.submittedAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ value: count() }).from(order).where(where),
      ]);

      // Flag orders that share a (paymentMethodId, referenceNumber) pair with
      // another order — a possible duplicate receipt.
      const items: ReviewQueueItem[] = [];
      for (const o of rows) {
        let isDuplicate = false;
        if (o.paymentMethodId && o.referenceNumber) {
          const [dup] = await ctx.db
            .select({ value: count() })
            .from(order)
            .where(
              and(
                eq(order.paymentMethodId, o.paymentMethodId),
                eq(order.referenceNumber, o.referenceNumber),
                sql`${order.id} <> ${o.id}`,
              ),
            );
          isDuplicate = (dup?.value ?? 0) > 0;
        }
        items.push({ order: o, isDuplicateReference: isDuplicate });
      }

      return {
        items,
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Approve: conditional update WHERE status = 'for_review'. Seats reserved →
   * sold, one ticket per seat generated, approval email sent. Zero rows
   * updated → CONFLICT ("already reviewed").
   */
  approve: permissionProcedure("orders:review")
    .input(approveOrderSchema)
    .mutation(async ({ ctx, input }): Promise<Order> => {
      const result = await ctx.db.transaction(async (tx) => {
        const before = await tx.query.order.findFirst({
          where: eq(order.id, input.orderId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });

        // Conditional update — only succeeds while still for_review.
        const [row] = await tx
          .update(order)
          .set({
            status: "approved",
            reviewedById: ctx.user.id,
            reviewedAt: new Date(),
            rejectionReason: null,
          })
          .where(
            and(eq(order.id, input.orderId), eq(order.status, "for_review")),
          )
          .returning();
        if (!row) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Order was already reviewed",
          });
        }

        const items = await tx
          .select()
          .from(orderItem)
          .where(eq(orderItem.orderId, row.id));

        const buyer = await tx.query.user.findFirst({
          where: eq(user.id, row.userId),
          columns: { name: true, email: true },
        });

        // Promote inventory and generate one ticket per seat / per GA qty.
        for (const item of items) {
          if (item.seatId) {
            const [seatRow] = await tx
              .update(seat)
              .set({ status: "sold" })
              .where(and(eq(seat.id, item.seatId), eq(seat.status, "held")))
              .returning();
            if (!seatRow) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "A seat is no longer held for this order",
              });
            }
            await tx.insert(ticket).values({
              orderId: row.id,
              eventId: row.eventId,
              seatId: item.seatId,
              holderName: buyer?.name ?? null,
              token: generateTicketToken(),
              status: "active",
            });
          } else if (item.tierId) {
            // reserved -> sold on the tier.
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
        }

        const ev = await tx.query.event.findFirst({
          where: eq(event.id, row.eventId),
          columns: { title: true },
        });

        await audit(
          ctx,
          {
            action: "order.approve",
            entityType: "order",
            entityId: row.id,
            before,
            after: row,
          },
          tx,
        );
        return {
          row,
          email: buyer?.email ?? null,
          eventTitle: ev?.title ?? "",
        };
      });

      if (result.email) {
        await sendEmail({
          to: result.email,
          subject: `Your order ${result.row.code} is approved`,
          react: OrderApprovedEmail({
            orderCode: result.row.code,
            eventTitle: result.eventTitle,
          }),
        });
      }
      return result.row;
    }),

  /** Reject (reason required); customer may re-upload once before expiry. */
  reject: permissionProcedure("orders:review")
    .input(rejectOrderSchema)
    .mutation(async ({ ctx, input }): Promise<Order> => {
      const result = await ctx.db.transaction(async (tx) => {
        const before = await tx.query.order.findFirst({
          where: eq(order.id, input.orderId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });

        const [row] = await tx
          .update(order)
          .set({
            status: "rejected",
            reviewedById: ctx.user.id,
            reviewedAt: new Date(),
            rejectionReason: input.reason,
          })
          .where(
            and(eq(order.id, input.orderId), eq(order.status, "for_review")),
          )
          .returning();
        if (!row) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Order was already reviewed",
          });
        }

        // Customer may re-upload once while the window is open and they haven't
        // used their resubmit. Otherwise this is a final rejection and we free
        // the held inventory.
        const windowOpen = !!row.expiresAt && row.expiresAt > new Date();
        const canResubmit = windowOpen && row.resubmitCount < 1;
        if (!canResubmit) {
          await releaseHeldInventory(tx, row.id);
        }

        const buyer = await tx.query.user.findFirst({
          where: eq(user.id, row.userId),
          columns: { email: true },
        });
        const ev = await tx.query.event.findFirst({
          where: eq(event.id, row.eventId),
          columns: { title: true },
        });

        await audit(
          ctx,
          {
            action: "order.reject",
            entityType: "order",
            entityId: row.id,
            before,
            after: row,
          },
          tx,
        );
        return {
          row,
          canResubmit,
          email: buyer?.email ?? null,
          eventTitle: ev?.title ?? "",
        };
      });

      if (result.email) {
        await sendEmail({
          to: result.email,
          subject: `Your order ${result.row.code} was rejected`,
          react: OrderRejectedEmail({
            orderCode: result.row.code,
            eventTitle: result.eventTitle,
            reason: input.reason,
            canResubmit: result.canResubmit,
          }),
        });
      }
      return result.row;
    }),
} satisfies TRPCRouterRecord;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Release held seats + tier reservations for a (final-reject) order. */
async function releaseHeldInventory(tx: Tx, orderId: string): Promise<void> {
  await tx
    .update(seat)
    .set({ status: "available", heldByOrderId: null })
    .where(and(eq(seat.heldByOrderId, orderId), eq(seat.status, "held")));

  const items = await tx
    .select()
    .from(orderItem)
    .where(
      and(eq(orderItem.orderId, orderId), sql`${orderItem.tierId} is not null`),
    );
  for (const item of items) {
    if (!item.tierId) continue;
    const [tier] = await tx
      .select()
      .from(ticketTier)
      .where(eq(ticketTier.id, item.tierId))
      .for("update");
    if (!tier) continue;
    await tx
      .update(ticketTier)
      .set({ reserved: Math.max(0, tier.reserved - item.quantity) })
      .where(eq(ticketTier.id, item.tierId));
  }
}
