import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { db } from "@npa/db/client";
import type { Event, TicketTier } from "@npa/db/schema";
import { and, asc, count, desc, eq, ilike, or, sql } from "@npa/db";
import { event, order, seat, ticket, ticketTier } from "@npa/db/schema";
import {
  byIdSchema,
  createEventSchema,
  createTicketTierSchema,
  idSchema,
  listEventsSchema,
  setEventStatusSchema,
  updateEventSchema,
  updateTicketTierSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { audit } from "../audit";
import { toCsv } from "../lib";
import { permissionProcedure, publicProcedure } from "../trpc";

/** A db handle or an open transaction. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function eventHasOrders(
  exec: Executor,
  eventId: string,
): Promise<boolean> {
  const [row] = await exec
    .select({ id: order.id })
    .from(order)
    .where(eq(order.eventId, eventId))
    .limit(1);
  return !!row;
}

export const eventRouter = {
  /* ------------------------------ admin reads ----------------------------- */
  list: permissionProcedure("events:read")
    .input(listEventsSchema)
    .query(async ({ ctx, input }): Promise<Paginated<Event>> => {
      const where = and(
        input.search
          ? or(
              ilike(event.title, `%${input.search}%`),
              ilike(event.slug, `%${input.search}%`),
            )
          : undefined,
        input.status ? eq(event.status, input.status) : undefined,
      );
      const offset = (input.page - 1) * input.pageSize;
      const [items, [totalRow]] = await Promise.all([
        ctx.db
          .select()
          .from(event)
          .where(where)
          .orderBy(desc(event.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ value: count() }).from(event).where(where),
      ]);
      return {
        items,
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  byId: permissionProcedure("events:read")
    .input(byIdSchema)
    .query(async ({ ctx, input }): Promise<Event | null> => {
      const row = await ctx.db.query.event.findFirst({
        where: eq(event.id, input.id),
      });
      return row ?? null;
    }),

  /* ----------------------------- public reads ----------------------------- */
  publicList: publicProcedure.query(async ({ ctx }): Promise<Event[]> => {
    return ctx.db
      .select()
      .from(event)
      .where(eq(event.status, "published"))
      .orderBy(asc(event.startsAt));
  }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<Event | null> => {
      const row = await ctx.db.query.event.findFirst({
        where: and(eq(event.slug, input.slug), eq(event.status, "published")),
      });
      return row ?? null;
    }),

  /* ------------------------------- mutations ------------------------------ */
  create: permissionProcedure("events:write")
    .input(createEventSchema)
    .mutation(async ({ ctx, input }): Promise<Event> => {
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx.insert(event).values(input).returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "event.create",
            entityType: "event",
            entityId: row.id,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  update: permissionProcedure("events:write")
    .input(updateEventSchema)
    .mutation(async ({ ctx, input }): Promise<Event> => {
      const { id, ...patch } = input;
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.event.findFirst({
          where: eq(event.id, id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });

        if (
          patch.seatingMode &&
          patch.seatingMode !== before.seatingMode &&
          (await eventHasOrders(tx, id))
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Seating mode can't change once an order exists",
          });
        }

        const [row] = await tx
          .update(event)
          .set(patch)
          .where(eq(event.id, id))
          .returning();
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        await audit(
          ctx,
          {
            action: "event.update",
            entityType: "event",
            entityId: id,
            before,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  setStatus: permissionProcedure("events:write")
    .input(setEventStatusSchema)
    .mutation(async ({ ctx, input }): Promise<Event> => {
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.event.findFirst({
          where: eq(event.id, input.id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        const [row] = await tx
          .update(event)
          .set({ status: input.status })
          .where(eq(event.id, input.id))
          .returning();
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        await audit(
          ctx,
          {
            action: "event.set_status",
            entityType: "event",
            entityId: input.id,
            before: { status: before.status },
            after: { status: row.status },
          },
          tx,
        );
        return row;
      });
    }),

  delete: permissionProcedure("events:delete")
    .input(byIdSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      return ctx.db.transaction(async (tx) => {
        if (await eventHasOrders(tx, input.id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete an event that has orders",
          });
        }
        const before = await tx.query.event.findFirst({
          where: eq(event.id, input.id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        await tx.delete(event).where(eq(event.id, input.id));
        await audit(
          ctx,
          {
            action: "event.delete",
            entityType: "event",
            entityId: input.id,
            before,
          },
          tx,
        );
        return { id: input.id };
      });
    }),

  attendeesCsv: permissionProcedure("events:read")
    .input(byIdSchema)
    .query(async ({ ctx, input }): Promise<string> => {
      const rows = await ctx.db
        .select({
          // NB: never export ticket.token — it is the sole QR secret.
          holderName: ticket.holderName,
          status: ticket.status,
          seatLabel: seat.label,
          tierName: ticketTier.name,
          orderCode: order.code,
          usedAt: ticket.usedAt,
        })
        .from(ticket)
        .leftJoin(seat, eq(ticket.seatId, seat.id))
        .leftJoin(ticketTier, eq(ticket.tierId, ticketTier.id))
        .innerJoin(order, eq(ticket.orderId, order.id))
        .where(
          and(eq(ticket.eventId, input.id), sql`${ticket.status} <> 'void'`),
        )
        .orderBy(asc(order.code));

      const header = ["Order", "Holder", "Seat/Tier", "Status", "Used At"];
      const body = rows.map((r) => [
        r.orderCode,
        r.holderName ?? "",
        r.seatLabel ?? r.tierName ?? "",
        r.status,
        r.usedAt ? r.usedAt.toISOString() : "",
      ]);
      return toCsv([header, ...body]);
    }),

  /* ----------------------------- GA ticket tiers -------------------------- */
  tiersByEvent: publicProcedure
    .input(z.object({ eventId: idSchema }))
    .query(async ({ ctx, input }): Promise<TicketTier[]> => {
      return ctx.db
        .select()
        .from(ticketTier)
        .where(eq(ticketTier.eventId, input.eventId))
        .orderBy(asc(ticketTier.sortOrder));
    }),

  createTier: permissionProcedure("events:write")
    .input(createTicketTierSchema)
    .mutation(async ({ ctx, input }): Promise<TicketTier> => {
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx.insert(ticketTier).values(input).returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "ticket_tier.create",
            entityType: "ticket_tier",
            entityId: row.id,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  updateTier: permissionProcedure("events:write")
    .input(updateTicketTierSchema)
    .mutation(async ({ ctx, input }): Promise<TicketTier> => {
      const { id, ...patch } = input;
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.ticketTier.findFirst({
          where: eq(ticketTier.id, id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        if (
          patch.capacity !== undefined &&
          patch.capacity < before.reserved + before.sold
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Capacity can't drop below reserved + sold",
          });
        }
        // Same rule as create, checked against the values after this edit.
        const salesStartAt = patch.salesStartAt ?? before.salesStartAt;
        const salesEndAt = patch.salesEndAt ?? before.salesEndAt;
        if (salesStartAt && salesEndAt && salesStartAt > salesEndAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sales start must be before sales end",
          });
        }
        const [row] = await tx
          .update(ticketTier)
          .set(patch)
          .where(eq(ticketTier.id, id))
          .returning();
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        await audit(
          ctx,
          {
            action: "ticket_tier.update",
            entityType: "ticket_tier",
            entityId: id,
            before,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  deleteTier: permissionProcedure("events:write")
    .input(byIdSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.ticketTier.findFirst({
          where: eq(ticketTier.id, input.id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        if (before.reserved + before.sold > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete a tier with reserved or sold tickets",
          });
        }
        await tx.delete(ticketTier).where(eq(ticketTier.id, input.id));
        await audit(
          ctx,
          {
            action: "ticket_tier.delete",
            entityType: "ticket_tier",
            entityId: input.id,
            before,
          },
          tx,
        );
        return { id: input.id };
      });
    }),
} satisfies TRPCRouterRecord;
