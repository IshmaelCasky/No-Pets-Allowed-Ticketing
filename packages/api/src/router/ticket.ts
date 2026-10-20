import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import type { Ticket } from "@npa/db/schema";
import { desc, eq } from "@npa/db";
import { order, seat, ticket, ticketTier } from "@npa/db/schema";
import {
  byIdSchema,
  updateTicketHolderSchema,
  voidTicketSchema,
} from "@npa/validators";

import { audit } from "../audit";
import { permissionProcedure, protectedProcedure } from "../trpc";

export const ticketRouter = {
  /** Current user's tickets (grouped by status in the UI). */
  myTickets: protectedProcedure.query(async ({ ctx }): Promise<Ticket[]> => {
    return ctx.db
      .select({
        id: ticket.id,
        orderId: ticket.orderId,
        eventId: ticket.eventId,
        tierId: ticket.tierId,
        seatId: ticket.seatId,
        holderName: ticket.holderName,
        token: ticket.token,
        status: ticket.status,
        usedAt: ticket.usedAt,
        usedById: ticket.usedById,
        createdAt: ticket.createdAt,
      })
      .from(ticket)
      .innerJoin(order, eq(ticket.orderId, order.id))
      .where(eq(order.userId, ctx.session.user.id))
      .orderBy(desc(ticket.createdAt));
  }),

  byId: protectedProcedure
    .input(byIdSchema)
    .query(async ({ ctx, input }): Promise<Ticket | null> => {
      const row = await ctx.db.query.ticket.findFirst({
        where: eq(ticket.id, input.id),
      });
      if (!row) return null;
      const ord = await ctx.db.query.order.findFirst({
        where: eq(order.id, row.orderId),
        columns: { userId: true },
      });
      if (ord?.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return row;
    }),

  /** Editable holder name per ticket. */
  updateHolder: protectedProcedure
    .input(updateTicketHolderSchema)
    .mutation(async ({ ctx, input }): Promise<Ticket> => {
      return ctx.db.transaction(async (tx) => {
        const row = await tx.query.ticket.findFirst({
          where: eq(ticket.id, input.ticketId),
        });
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        const ord = await tx.query.order.findFirst({
          where: eq(order.id, row.orderId),
          columns: { userId: true },
        });
        if (ord?.userId !== ctx.session.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (row.status !== "active") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only active tickets can be edited",
          });
        }
        const [updated] = await tx
          .update(ticket)
          .set({ holderName: input.holderName ?? null })
          .where(eq(ticket.id, input.ticketId))
          .returning();
        if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return updated;
      });
    }),

  /** Admin void (e.g. part of a refund). */
  void: permissionProcedure("tickets:void")
    .input(voidTicketSchema)
    .mutation(async ({ ctx, input }): Promise<Ticket> => {
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.ticket.findFirst({
          where: eq(ticket.id, input.ticketId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        if (before.status === "void") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ticket is already void",
          });
        }
        const [row] = await tx
          .update(ticket)
          .set({ status: "void" })
          .where(eq(ticket.id, input.ticketId))
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Free the backing inventory.
        if (before.seatId) {
          await tx
            .update(seat)
            .set({ status: "available", heldByOrderId: null })
            .where(eq(seat.id, before.seatId));
        } else if (before.tierId) {
          const [tier] = await tx
            .select()
            .from(ticketTier)
            .where(eq(ticketTier.id, before.tierId))
            .for("update");
          if (tier) {
            await tx
              .update(ticketTier)
              .set({ sold: Math.max(0, tier.sold - 1) })
              .where(eq(ticketTier.id, before.tierId));
          }
        }

        await audit(
          ctx,
          {
            action: "ticket.void",
            entityType: "ticket",
            entityId: row.id,
            before,
            after: { ...row, reason: input.reason ?? null },
          },
          tx,
        );
        return row;
      });
    }),
} satisfies TRPCRouterRecord;
