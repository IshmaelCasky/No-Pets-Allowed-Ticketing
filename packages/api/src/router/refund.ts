import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { db } from "@npa/db/client";
import type { RefundRequest } from "@npa/db/schema";
import { and, count, desc, eq, sql } from "@npa/db";
import {
  event,
  order,
  refundRequest,
  role,
  ticket,
  ticketTier,
  user,
} from "@npa/db/schema";
import {
  approveRefundSchema,
  listRefundsSchema,
  markRefundPaidSchema,
  rejectRefundSchema,
  requestRefundSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { audit } from "../audit";
import {
  RefundApprovedEmail,
  RefundPaidEmail,
  RefundRejectedEmail,
  sendEmail,
} from "../emails";
import { signedProofUrl } from "../lib";
import { permissionProcedure, protectedProcedure } from "../trpc";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db;

/**
 * A refund request plus what reviewers need to see without `users:read`:
 * the order, its concert and the buyer.
 */
export interface RefundQueueRow extends RefundRequest {
  orderCode: string | null;
  totalAmount: number | null;
  eventId: string | null;
  eventTitle: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
}

function refundRowQuery(dbc: Db | Tx) {
  return dbc
    .select({
      refund: refundRequest,
      orderCode: order.code,
      totalAmount: order.totalAmount,
      eventId: order.eventId,
      eventTitle: event.title,
      buyerName: user.name,
      buyerEmail: user.email,
    })
    .from(refundRequest)
    .leftJoin(order, eq(refundRequest.orderId, order.id))
    .leftJoin(event, eq(order.eventId, event.id))
    .leftJoin(user, eq(refundRequest.userId, user.id));
}

function toRefundRow(
  r: Awaited<ReturnType<typeof refundRowQuery>>[number],
): RefundQueueRow {
  const { refund, ...rest } = r;
  return { ...refund, ...rest };
}

export const refundRouter = {
  /** Customer requests a refund (allowed until refundCutoffDays before start). */
  request: protectedProcedure
    .input(requestRefundSchema)
    .mutation(async ({ ctx, input }): Promise<RefundRequest> => {
      const userId = ctx.session.user.id;
      return ctx.db.transaction(async (tx) => {
        const ord = await tx.query.order.findFirst({
          where: eq(order.id, input.orderId),
        });
        if (ord?.userId !== userId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        if (ord.status !== "approved") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only approved orders can be refunded",
          });
        }

        const ev = await tx.query.event.findFirst({
          where: eq(event.id, ord.eventId),
        });
        if (!ev) throw new TRPCError({ code: "NOT_FOUND" });
        if (ev.startsAt) {
          const cutoff = new Date(
            ev.startsAt.getTime() - ev.refundCutoffDays * 24 * 60 * 60 * 1000,
          );
          if (new Date() > cutoff) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "The refund window for this event has closed",
            });
          }
        }

        // Used tickets block a refund.
        const [usedRow] = await tx
          .select({ id: ticket.id })
          .from(ticket)
          .where(and(eq(ticket.orderId, ord.id), eq(ticket.status, "used")))
          .limit(1);
        if (usedRow) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tickets have already been used",
          });
        }

        // One open request per order (also backed by a partial unique index).
        const [open] = await tx
          .select({ id: refundRequest.id })
          .from(refundRequest)
          .where(
            and(
              eq(refundRequest.orderId, ord.id),
              sql`${refundRequest.status} in ('requested', 'approved')`,
            ),
          )
          .limit(1);
        if (open) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A refund request is already open for this order",
          });
        }

        const [row] = await tx
          .insert(refundRequest)
          .values({
            orderId: ord.id,
            userId,
            reason: input.reason,
            payoutMethod: input.payoutMethod,
            payoutAccountName: input.payoutAccountName,
            payoutAccountNumber: input.payoutAccountNumber,
            status: "requested",
          })
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "refund.request",
            entityType: "refund_request",
            entityId: row.id,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  myRefunds: protectedProcedure.query(
    async ({ ctx }): Promise<RefundRequest[]> => {
      return ctx.db
        .select()
        .from(refundRequest)
        .where(eq(refundRequest.userId, ctx.session.user.id))
        .orderBy(desc(refundRequest.createdAt));
    },
  ),

  /* ------------------------------ staff queue ----------------------------- */
  queue: permissionProcedure("refunds:review")
    .input(listRefundsSchema)
    .query(async ({ ctx, input }): Promise<Paginated<RefundQueueRow>> => {
      const filters = [];
      if (input.status) filters.push(eq(refundRequest.status, input.status));
      if (input.eventId) {
        filters.push(
          sql`${refundRequest.orderId} in (select ${order.id} from ${order} where ${order.eventId} = ${input.eventId})`,
        );
      }
      const where = filters.length ? and(...filters) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [rows, [totalRow]] = await Promise.all([
        refundRowQuery(ctx.db)
          .where(where)
          .orderBy(desc(refundRequest.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ value: count() }).from(refundRequest).where(where),
      ]);
      return {
        items: rows.map(toRefundRow),
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** One refund request with its order / concert / buyer (review screen). */
  byId: permissionProcedure("refunds:review")
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<RefundQueueRow> => {
      const [row] = await refundRowQuery(ctx.db)
        .where(eq(refundRequest.id, input.id))
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Refund not found" });
      }
      return toRefundRow(row);
    }),

  /** Approve → tickets void immediately, seats/tier released, order stays approved until paid. */
  approve: permissionProcedure("refunds:review")
    .input(approveRefundSchema)
    .mutation(async ({ ctx, input }): Promise<RefundRequest> => {
      const result = await ctx.db.transaction(async (tx) => {
        const before = await tx.query.refundRequest.findFirst({
          where: eq(refundRequest.id, input.refundRequestId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });

        const [row] = await tx
          .update(refundRequest)
          .set({
            status: "approved",
            reviewedById: ctx.user.id,
            reviewedAt: new Date(),
          })
          .where(
            and(
              eq(refundRequest.id, input.refundRequestId),
              eq(refundRequest.status, "requested"),
            ),
          )
          .returning();
        if (!row) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Refund request was already reviewed",
          });
        }

        await voidTicketsAndFreeInventory(tx, row.orderId);

        const ctxData = await loadNotify(tx, row.orderId);
        await audit(
          ctx,
          {
            action: "refund.approve",
            entityType: "refund_request",
            entityId: row.id,
            before,
            after: row,
          },
          tx,
        );
        return { row, ...ctxData };
      });

      if (result.email) {
        await sendEmail({
          to: result.email,
          subject: `Refund approved for ${result.orderCode}`,
          react: RefundApprovedEmail({
            orderCode: result.orderCode,
            eventTitle: result.eventTitle,
          }),
        });
      }
      return result.row;
    }),

  /** Reject (reason required); tickets untouched. */
  reject: permissionProcedure("refunds:review")
    .input(rejectRefundSchema)
    .mutation(async ({ ctx, input }): Promise<RefundRequest> => {
      const result = await ctx.db.transaction(async (tx) => {
        const before = await tx.query.refundRequest.findFirst({
          where: eq(refundRequest.id, input.refundRequestId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });

        const [row] = await tx
          .update(refundRequest)
          .set({
            status: "rejected",
            reviewedById: ctx.user.id,
            reviewedAt: new Date(),
            rejectionReason: input.reason,
          })
          .where(
            and(
              eq(refundRequest.id, input.refundRequestId),
              eq(refundRequest.status, "requested"),
            ),
          )
          .returning();
        if (!row) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Refund request was already reviewed",
          });
        }

        const ctxData = await loadNotify(tx, row.orderId);
        await audit(
          ctx,
          {
            action: "refund.reject",
            entityType: "refund_request",
            entityId: row.id,
            before,
            after: row,
          },
          tx,
        );
        return { row, ...ctxData };
      });

      if (result.email) {
        await sendEmail({
          to: result.email,
          subject: `Refund rejected for ${result.orderCode}`,
          react: RefundRejectedEmail({
            orderCode: result.orderCode,
            eventTitle: result.eventTitle,
            reason: input.reason,
          }),
        });
      }
      return result.row;
    }),

  /** Mark paid with transfer receipt + reference → order `refunded`. */
  markPaid: permissionProcedure("refunds:review")
    .input(markRefundPaidSchema)
    .mutation(async ({ ctx, input }): Promise<RefundRequest> => {
      const result = await ctx.db.transaction(async (tx) => {
        const before = await tx.query.refundRequest.findFirst({
          where: eq(refundRequest.id, input.refundRequestId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });

        const [row] = await tx
          .update(refundRequest)
          .set({
            status: "paid",
            payoutReference: input.payoutReference,
            payoutProofKey: input.payoutProofKey,
            paidAt: new Date(),
          })
          .where(
            and(
              eq(refundRequest.id, input.refundRequestId),
              eq(refundRequest.status, "approved"),
            ),
          )
          .returning();
        if (!row) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Only an approved refund can be marked paid",
          });
        }

        const [ord] = await tx
          .update(order)
          .set({ status: "refunded" })
          .where(eq(order.id, row.orderId))
          .returning();

        const ctxData = await loadNotify(tx, row.orderId);
        await audit(
          ctx,
          {
            action: "refund.pay",
            entityType: "refund_request",
            entityId: row.id,
            before,
            after: row,
          },
          tx,
        );
        return {
          row,
          ...ctxData,
          amount: ord?.totalAmount ?? 0,
        };
      });

      if (result.email) {
        await sendEmail({
          to: result.email,
          subject: `Refund paid for ${result.orderCode}`,
          react: RefundPaidEmail({
            orderCode: result.orderCode,
            eventTitle: result.eventTitle,
            amount: result.amount,
            payoutReference: input.payoutReference,
          }),
        });
      }
      return result.row;
    }),

  /** Short-lived signed URL for the transfer-receipt proof. Owner or refunds:review. */
  proofUrl: protectedProcedure
    .input(z.object({ refundRequestId: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<{ url: string | null }> => {
      const row = await ctx.db.query.refundRequest.findFirst({
        where: eq(refundRequest.id, input.refundRequestId),
        columns: { userId: true, payoutProofKey: true },
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
        if (!roleRow?.permissions.includes("refunds:review")) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return { url: await signedProofUrl(row.payoutProofKey) };
    }),
} satisfies TRPCRouterRecord;

/** Resolve the buyer email + order code + event title for a notification. */
async function loadNotify(
  tx: Tx,
  orderId: string,
): Promise<{ email: string | null; orderCode: string; eventTitle: string }> {
  const ord = await tx.query.order.findFirst({
    where: eq(order.id, orderId),
    columns: { code: true, userId: true, eventId: true },
  });
  if (!ord) return { email: null, orderCode: "", eventTitle: "" };
  const [buyer, ev] = await Promise.all([
    tx.query.user.findFirst({
      where: eq(user.id, ord.userId),
      columns: { email: true },
    }),
    tx.query.event.findFirst({
      where: eq(event.id, ord.eventId),
      columns: { title: true },
    }),
  ]);
  return {
    email: buyer?.email ?? null,
    orderCode: ord.code,
    eventTitle: ev?.title ?? "",
  };
}

/**
 * On refund approval: void the order's active tickets and return their
 * inventory — the ticket type's `sold` is decremented per voided ticket.
 */
async function voidTicketsAndFreeInventory(
  tx: Tx,
  orderId: string,
): Promise<void> {
  const tickets = await tx
    .select()
    .from(ticket)
    .where(and(eq(ticket.orderId, orderId), eq(ticket.status, "active")));

  for (const t of tickets) {
    await tx.update(ticket).set({ status: "void" }).where(eq(ticket.id, t.id));

    const [tier] = await tx
      .select()
      .from(ticketTier)
      .where(eq(ticketTier.id, t.tierId))
      .for("update");
    if (tier) {
      await tx
        .update(ticketTier)
        .set({ sold: Math.max(0, tier.sold - 1) })
        .where(eq(ticketTier.id, t.tierId));
    }
  }
}
