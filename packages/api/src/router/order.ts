import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { db } from "@npa/db/client";
import type { Order } from "@npa/db/schema";
import { and, count, desc, eq, inArray, lte, ne, or, sql } from "@npa/db";
import {
  event,
  order,
  orderItem,
  role,
  seat,
  seatSection,
  ticketTier,
} from "@npa/db/schema";
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersSchema,
  submitPaymentProofSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { audit } from "../audit";
import { generateOrderCode, signedProofUrl } from "../lib";
import {
  permissionProcedure,
  protectedProcedure,
  publicProcedure,
} from "../trpc";

/** A drizzle transaction handle (what `db.transaction` passes to its callback). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 30-minute payment window from order creation. */
const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

/** Statuses whose held seats/tier inventory are still reserved. */
function releasableStatuses() {
  return ["pending_payment", "for_review"] as const;
}

export const orderRouter = {
  /**
   * Create an order. Reserves seats/tier inventory in one transaction and sets
   * the 30-minute payment window (`expiresAt`). Reserved seats taken mid-
   * checkout throw CONFLICT with the taken seat ids.
   */
  create: protectedProcedure
    .input(createOrderSchema)
    .mutation(async ({ ctx, input }): Promise<Order> => {
      const userId = ctx.session.user.id;
      return ctx.db.transaction(async (tx) => {
        const ev = await tx.query.event.findFirst({
          where: eq(event.id, input.eventId),
        });
        if (!ev)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Event not found",
          });
        if (ev.status !== "published") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Event is not open for sale",
          });
        }
        if (ev.seatingMode !== input.mode) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Event uses ${ev.seatingMode} seating`,
          });
        }

        const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MS);
        const code = generateOrderCode();

        if (input.mode === "ga") {
          const totalQty = input.items.reduce((s, i) => s + i.quantity, 0);
          if (totalQty > ev.maxPerOrder) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Max ${ev.maxPerOrder} tickets per order`,
            });
          }
          // Reject duplicate tier lines so FOR UPDATE + increments stay correct.
          const seen = new Set<string>();
          for (const line of input.items) {
            if (seen.has(line.tierId)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Duplicate tier in order",
              });
            }
            seen.add(line.tierId);
          }

          const [orderRow] = await tx
            .insert(order)
            .values({
              code,
              userId,
              eventId: ev.id,
              status: "pending_payment",
              totalAmount: 0,
              expiresAt,
            })
            .returning();
          if (!orderRow) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          let total = 0;
          for (const line of input.items) {
            // Lock the tier row, then check capacity and increment reserved.
            const [tier] = await tx
              .select()
              .from(ticketTier)
              .where(eq(ticketTier.id, line.tierId))
              .for("update");
            if (!tier || tier.eventId !== ev.id) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Ticket tier not found",
              });
            }
            const now = new Date();
            if (
              (tier.salesStartAt && tier.salesStartAt > now) ||
              (tier.salesEndAt && tier.salesEndAt < now)
            ) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `${tier.name} is not on sale`,
              });
            }
            const remaining = tier.capacity - tier.reserved - tier.sold;
            if (remaining < line.quantity) {
              throw new TRPCError({
                code: "CONFLICT",
                message: `Only ${remaining} left for ${tier.name}`,
              });
            }
            await tx
              .update(ticketTier)
              .set({ reserved: tier.reserved + line.quantity })
              .where(eq(ticketTier.id, tier.id));
            await tx.insert(orderItem).values({
              orderId: orderRow.id,
              tierId: tier.id,
              quantity: line.quantity,
              unitPrice: tier.price,
            });
            total += tier.price * line.quantity;
          }

          const [updated] = await tx
            .update(order)
            .set({ totalAmount: total })
            .where(eq(order.id, orderRow.id))
            .returning();
          if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          await audit(
            ctx,
            {
              action: "order.create",
              entityType: "order",
              entityId: updated.id,
              after: updated,
            },
            tx,
          );
          return updated;
        }

        // reserved
        const uniqueSeatIds = [...new Set(input.seatIds)];
        if (uniqueSeatIds.length > ev.maxPerOrder) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Max ${ev.maxPerOrder} seats per order`,
          });
        }

        const [orderRow] = await tx
          .insert(order)
          .values({
            code,
            userId,
            eventId: ev.id,
            status: "pending_payment",
            totalAmount: 0,
            expiresAt,
          })
          .returning();
        if (!orderRow) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Lock the chosen seats. Order by id for a stable lock order.
        const seatRows = await tx
          .select()
          .from(seat)
          .where(and(eq(seat.eventId, ev.id), inArray(seat.id, uniqueSeatIds)))
          .for("update");

        if (seatRows.length !== uniqueSeatIds.length) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Seat not found" });
        }
        const taken = seatRows
          .filter((s) => s.status !== "available")
          .map((s) => s.id);
        if (taken.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Some seats were just taken",
            cause: { takenSeatIds: taken },
          });
        }

        // Price each seat from its section.
        const sectionIds = [...new Set(seatRows.map((s) => s.sectionId))];
        const sections = await tx.query.seatSection.findMany({
          where: inArray(seatSection.id, sectionIds),
        });
        const priceBySection = new Map(sections.map((s) => [s.id, s.price]));

        let total = 0;
        for (const s of seatRows) {
          const price = priceBySection.get(s.sectionId);
          if (price == null) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          }
          await tx
            .update(seat)
            .set({ status: "held", heldByOrderId: orderRow.id })
            .where(eq(seat.id, s.id));
          await tx.insert(orderItem).values({
            orderId: orderRow.id,
            seatId: s.id,
            quantity: 1,
            unitPrice: price,
          });
          total += price;
        }

        const [updated] = await tx
          .update(order)
          .set({ totalAmount: total })
          .where(eq(order.id, orderRow.id))
          .returning();
        if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "order.create",
            entityType: "order",
            entityId: updated.id,
            after: updated,
          },
          tx,
        );
        return updated;
      });
    }),

  /** Upload receipt + reference → `for_review` (re-submittable once). */
  submitProof: protectedProcedure
    .input(submitPaymentProofSchema)
    .mutation(async ({ ctx, input }): Promise<Order> => {
      const userId = ctx.session.user.id;
      return ctx.db.transaction(async (tx) => {
        const existing = await tx.query.order.findFirst({
          where: eq(order.id, input.orderId),
        });
        if (existing?.userId !== userId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        // Allowed from pending_payment (first proof) or rejected (one re-upload).
        if (
          existing.status !== "pending_payment" &&
          existing.status !== "rejected"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Order is not awaiting payment",
          });
        }
        if (existing.expiresAt && existing.expiresAt < new Date()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Payment window has closed",
          });
        }
        if (existing.status === "rejected" && existing.resubmitCount >= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You have already re-submitted this order once",
          });
        }

        // Duplicate receipt guard — a friendly CONFLICT instead of the raw
        // unique-violation 500 from the (paymentMethodId, referenceNumber) index.
        const dup = await tx.query.order.findFirst({
          where: and(
            eq(order.paymentMethodId, input.paymentMethodId),
            eq(order.referenceNumber, input.referenceNumber),
            ne(order.id, input.orderId),
          ),
          columns: { id: true },
        });
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This reference number was already submitted for this payment method",
          });
        }

        const resubmit = existing.status === "rejected";
        let row;
        try {
          [row] = await tx
            .update(order)
            .set({
              status: "for_review",
              paymentMethodId: input.paymentMethodId,
              referenceNumber: input.referenceNumber,
              proofImageKey: input.proofImageKey,
              submittedAt: new Date(),
              rejectionReason: null,
              resubmitCount: resubmit
                ? existing.resubmitCount + 1
                : existing.resubmitCount,
            })
            .where(eq(order.id, input.orderId))
            .returning();
        } catch (e) {
          // Concurrent submit lost the race against the unique index.
          if ((e as { code?: string }).code === "23505") {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This reference number was already submitted for this payment method",
            });
          }
          throw e;
        }
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return row;
      });
    }),

  /* ---------------------------- customer reads ---------------------------- */
  myOrders: protectedProcedure.query(async ({ ctx }): Promise<Order[]> => {
    return ctx.db
      .select()
      .from(order)
      .where(eq(order.userId, ctx.session.user.id))
      .orderBy(desc(order.createdAt));
  }),

  byCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<Order | null> => {
      const row = await ctx.db.query.order.findFirst({
        where: eq(order.code, input.code),
      });
      if (!row) return null;
      // Owner, or any user with orders:read, may view.
      if (row.userId !== ctx.session.user.id) {
        const u = ctx.session.user as typeof ctx.session.user & {
          roleId?: string | null;
        };
        const roleRow = u.roleId
          ? await ctx.db.query.role.findFirst({
              where: eq(role.id, u.roleId),
              columns: { permissions: true },
            })
          : null;
        if (!roleRow?.permissions.includes("orders:read")) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return row;
    }),

  /** Short-lived signed URL for an order's payment proof. Owner or orders:read. */
  proofUrl: protectedProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<{ url: string | null }> => {
      const row = await ctx.db.query.order.findFirst({
        where: eq(order.id, input.orderId),
        columns: { userId: true, proofImageKey: true },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.userId !== ctx.session.user.id) {
        const u = ctx.session.user as typeof ctx.session.user & {
          roleId?: string | null;
        };
        const roleRow = u.roleId
          ? await ctx.db.query.role.findFirst({
              where: eq(role.id, u.roleId),
              columns: { permissions: true },
            })
          : null;
        if (!roleRow?.permissions.includes("orders:read")) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return { url: await signedProofUrl(row.proofImageKey) };
    }),

  /* ----------------------------- admin orders ----------------------------- */
  /** Search all orders by code / reference / buyer. */
  adminList: permissionProcedure("orders:read")
    .input(listOrdersSchema)
    .query(async ({ ctx, input }): Promise<Paginated<Order>> => {
      const filters = [];
      if (input.status) filters.push(eq(order.status, input.status));
      if (input.eventId) filters.push(eq(order.eventId, input.eventId));
      if (input.search) {
        filters.push(
          or(
            sql`${order.code} ilike ${`%${input.search}%`}`,
            sql`${order.referenceNumber} ilike ${`%${input.search}%`}`,
          ),
        );
      }
      const where = filters.length ? and(...filters) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [items, [totalRow]] = await Promise.all([
        ctx.db
          .select()
          .from(order)
          .where(where)
          .orderBy(desc(order.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ value: count() }).from(order).where(where),
      ]);
      return {
        items,
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** Cancel an order with a note; releases held inventory. */
  cancel: permissionProcedure("orders:review")
    .input(cancelOrderSchema)
    .mutation(async ({ ctx, input }): Promise<Order> => {
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.order.findFirst({
          where: eq(order.id, input.id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        if (
          before.status !== "pending_payment" &&
          before.status !== "for_review"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only unpaid orders can be cancelled",
          });
        }
        await releaseInventory(tx, before.id);
        const [row] = await tx
          .update(order)
          .set({
            status: "cancelled",
            rejectionReason: input.note ?? null,
          })
          .where(eq(order.id, input.id))
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "order.cancel",
            entityType: "order",
            entityId: row.id,
            before,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  /**
   * Release expired, unpaid orders (reserved seats/tier back to available).
   * Called by the Vercel cron every 5 min via a server-side caller after the
   * route verifies `CRON_SECRET`.
   */
  releaseExpired: publicProcedure.mutation(
    async ({ ctx }): Promise<{ released: number }> => {
      // Server-to-server only: the Vercel cron route forwards
      // `Authorization: Bearer $CRON_SECRET`. Reject anything else so this is
      // not an open abuse surface over /api/trpc.
      const secret = process.env.CRON_SECRET;
      if (!secret || ctx.headers.get("authorization") !== `Bearer ${secret}`) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const now = new Date();
      const expired = await ctx.db
        .select({ id: order.id })
        .from(order)
        .where(
          and(
            inArray(order.status, [...releasableStatuses()]),
            sql`${order.expiresAt} is not null`,
            lte(order.expiresAt, now),
          ),
        );

      let released = 0;
      for (const { id } of expired) {
        await ctx.db.transaction(async (tx) => {
          // Re-check status under the row to avoid racing an approval.
          const [current] = await tx
            .select()
            .from(order)
            .where(eq(order.id, id))
            .for("update");
          if (
            !current ||
            (current.status !== "pending_payment" &&
              current.status !== "for_review")
          ) {
            return;
          }
          if (!current.expiresAt || current.expiresAt > now) return;
          await releaseInventory(tx, id);
          await tx
            .update(order)
            .set({ status: "expired" })
            .where(eq(order.id, id));
          released++;
        });
      }
      return { released };
    },
  ),
} satisfies TRPCRouterRecord;

/**
 * Release the inventory held by an order: seats back to available, tier
 * `reserved` decremented. Call inside the order's transaction. Only acts on
 * seats still held by this order so it is safe to call repeatedly.
 */
async function releaseInventory(tx: Tx, orderId: string): Promise<void> {
  // Reserved seats held by this order → available.
  await tx
    .update(seat)
    .set({ status: "available", heldByOrderId: null })
    .where(and(eq(seat.heldByOrderId, orderId), eq(seat.status, "held")));

  // GA tier reservations recorded on order_item (tier lines).
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
    const next = Math.max(0, tier.reserved - item.quantity);
    await tx
      .update(ticketTier)
      .set({ reserved: next })
      .where(eq(ticketTier.id, item.tierId));
  }
}
