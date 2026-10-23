import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { db } from "@npa/db/client";
import type { Order } from "@npa/db/schema";
import { and, asc, count, desc, eq, ilike, lte, or, sql } from "@npa/db";
import {
  event,
  order,
  orderItem,
  role,
  ticket,
  ticketTier,
  user,
} from "@npa/db/schema";
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { audit } from "../audit";
import { OrderApprovedEmail, sendEmail } from "../emails";
import { fulfillPaidOrderTx } from "../fulfill";
import {
  createPaymentRequest,
  getPaymentRequest,
  hitpayConfigured,
} from "../hitpay";
import { generateOrderCode } from "../lib";
import { permissionProcedure, protectedProcedure } from "../trpc";

/** App base URL for HitPay redirect/webhook callbacks. */
function appBaseUrl(): string {
  const base =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return base.replace(/\/$/, "");
}

/** A drizzle transaction handle (what `db.transaction` passes to its callback). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Admin order list row: the order plus its concert and buyer. */
export interface AdminOrderRow extends Order {
  eventTitle: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
}

/** Admin order detail: row + line items + tickets (never ticket tokens). */
export interface AdminOrderDetail extends AdminOrderRow {
  items: {
    id: string;
    tierName: string | null;
    quantity: number;
    unitPrice: number;
  }[];
  tickets: {
    id: string;
    status: "active" | "used" | "void";
    holderName: string | null;
    tierName: string | null;
    usedAt: Date | null;
  }[];
}

/** 30-minute payment window from order creation. */
const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

export const orderRouter = {
  /**
   * Create an order. Reserves ticket-type inventory in one transaction and sets
   * the 30-minute payment window (`expiresAt`), then creates a HitPay payment
   * request and returns its hosted-checkout URL. A ticket type that sells out
   * mid-checkout throws CONFLICT.
   */
  create: protectedProcedure
    .input(createOrderSchema)
    .mutation(
      async ({ ctx, input }): Promise<{ order: Order; paymentUrl: string }> => {
        const userId = ctx.session.user.id;
        const created = await ctx.db.transaction(async (tx) => {
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
              message: "Concert is not open for sale",
            });
          }

          // Free up any abandoned holds for this concert before reserving.
          await expireStaleOrders(tx, ev.id);

          const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MS);
          const code = generateOrderCode();

          const totalQty = input.items.reduce((s, i) => s + i.quantity, 0);
          if (totalQty > ev.maxPerOrder) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Max ${ev.maxPerOrder} tickets per order`,
            });
          }
          // Reject duplicate ticket-type lines so FOR UPDATE + increments stay correct.
          const seen = new Set<string>();
          for (const line of input.items) {
            if (seen.has(line.tierId)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Duplicate ticket type in order",
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
            // Lock the ticket-type row, check capacity, increment reserved.
            const [tier] = await tx
              .select()
              .from(ticketTier)
              .where(eq(ticketTier.id, line.tierId))
              .for("update");
            if (!tier || tier.eventId !== ev.id) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Ticket type not found",
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
        });

        if (!hitpayConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Payments are not configured",
          });
        }
        const base = appBaseUrl();
        const payment = await createPaymentRequest({
          amount: created.totalAmount,
          referenceNumber: created.code,
          redirectUrl: `${base}/orders/${created.code}`,
          webhook: `${base}/api/webhooks/hitpay`,
          name: ctx.session.user.name,
          email: ctx.session.user.email,
        });
        const [withPayment] = await ctx.db
          .update(order)
          .set({ hitpayPaymentId: payment.id, hitpayStatus: payment.status })
          .where(eq(order.id, created.id))
          .returning();
        return { order: withPayment ?? created, paymentUrl: payment.url };
      },
    ),

  /**
   * Reconcile an order against HitPay (fallback for the return page if the
   * webhook is delayed). If HitPay reports the payment completed, fulfil the
   * order (→ approved + tickets). Owner only.
   */
  syncPayment: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ ctx, input }): Promise<Order> => {
      const existing = await ctx.db.query.order.findFirst({
        where: eq(order.code, input.code),
      });
      if (!existing || existing.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (
        existing.status !== "pending_payment" ||
        !existing.hitpayPaymentId ||
        !hitpayConfigured()
      ) {
        return existing;
      }

      const hp = await getPaymentRequest(existing.hitpayPaymentId);
      if (hp.status !== "completed") {
        const [row] = await ctx.db
          .update(order)
          .set({ hitpayStatus: hp.status })
          .where(eq(order.id, existing.id))
          .returning();
        return row ?? existing;
      }

      const result = await ctx.db.transaction(async (tx) => {
        const r = await fulfillPaidOrderTx(tx, existing.id, hp.status);
        await audit(
          ctx,
          {
            action: "order.paid",
            entityType: "order",
            entityId: existing.id,
            after: r.order,
          },
          tx,
        );
        return r;
      });

      if (!result.alreadyFulfilled && result.email) {
        await sendEmail({
          to: result.email,
          subject: `Your order ${result.order.code} is confirmed`,
          react: OrderApprovedEmail({
            orderCode: result.order.code,
            eventTitle: result.eventTitle,
          }),
        });
      }
      return result.order;
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

  /* ----------------------------- admin orders ----------------------------- */
  /** Search all orders by code / buyer name / buyer email. */
  adminList: permissionProcedure("orders:read")
    .input(listOrdersSchema)
    .query(async ({ ctx, input }): Promise<Paginated<AdminOrderRow>> => {
      const filters = [];
      if (input.status) filters.push(eq(order.status, input.status));
      if (input.eventId) filters.push(eq(order.eventId, input.eventId));
      if (input.search) {
        const q = `%${input.search}%`;
        const match = or(
          ilike(order.code, q),
          ilike(user.name, q),
          ilike(user.email, q),
        );
        if (match) filters.push(match);
      }
      const where = filters.length ? and(...filters) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [rows, [totalRow]] = await Promise.all([
        ctx.db
          .select({
            order,
            eventTitle: event.title,
            buyerName: user.name,
            buyerEmail: user.email,
          })
          .from(order)
          .leftJoin(event, eq(order.eventId, event.id))
          .leftJoin(user, eq(order.userId, user.id))
          .where(where)
          .orderBy(desc(order.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ value: count() })
          .from(order)
          .leftJoin(user, eq(order.userId, user.id))
          .where(where),
      ]);
      return {
        items: rows.map(({ order: o, ...rest }) => ({ ...o, ...rest })),
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Full order for the admin detail screen: buyer, concert, line items and
   * tickets. Ticket tokens are never included.
   */
  adminDetail: permissionProcedure("orders:read")
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<AdminOrderDetail> => {
      const [row] = await ctx.db
        .select({
          order,
          eventTitle: event.title,
          buyerName: user.name,
          buyerEmail: user.email,
        })
        .from(order)
        .leftJoin(event, eq(order.eventId, event.id))
        .leftJoin(user, eq(order.userId, user.id))
        .where(eq(order.code, input.code))
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      const [items, tickets] = await Promise.all([
        ctx.db
          .select({
            id: orderItem.id,
            tierName: ticketTier.name,
            quantity: orderItem.quantity,
            unitPrice: orderItem.unitPrice,
          })
          .from(orderItem)
          .leftJoin(ticketTier, eq(orderItem.tierId, ticketTier.id))
          .where(eq(orderItem.orderId, row.order.id))
          .orderBy(asc(orderItem.id)),
        ctx.db
          .select({
            id: ticket.id,
            status: ticket.status,
            holderName: ticket.holderName,
            tierName: ticketTier.name,
            usedAt: ticket.usedAt,
          })
          .from(ticket)
          .leftJoin(ticketTier, eq(ticket.tierId, ticketTier.id))
          .where(eq(ticket.orderId, row.order.id))
          .orderBy(asc(ticket.createdAt)),
      ]);
      const { order: o, ...rest } = row;
      return { ...o, ...rest, items, tickets };
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
        if (before.status !== "pending_payment") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only unpaid orders can be cancelled",
          });
        }
        await releaseInventory(tx, before.id);
        const [row] = await tx
          .update(order)
          .set({ status: "cancelled" })
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
} satisfies TRPCRouterRecord;

/**
 * Expire a concert's unpaid orders whose 30-minute window has passed, releasing
 * the ticket inventory they hold. Run lazily inside checkout (no cron) so
 * abandoned holds free up just in time for the next buyer.
 */
async function expireStaleOrders(tx: Tx, eventId: string): Promise<void> {
  const now = new Date();
  const stale = await tx
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.eventId, eventId),
        eq(order.status, "pending_payment"),
        sql`${order.expiresAt} is not null`,
        lte(order.expiresAt, now),
      ),
    )
    .for("update");
  for (const { id } of stale) {
    await releaseInventory(tx, id);
    await tx.update(order).set({ status: "expired" }).where(eq(order.id, id));
  }
}

/**
 * Release the ticket-type `reserved` inventory held by an order. Call inside
 * the order's transaction; safe to call repeatedly.
 */
async function releaseInventory(tx: Tx, orderId: string): Promise<void> {
  const items = await tx
    .select()
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId));
  for (const item of items) {
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
