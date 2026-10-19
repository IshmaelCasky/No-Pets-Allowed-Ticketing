import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { Event, TicketTier } from "@npa/db/schema";
import {
  byIdSchema,
  createEventSchema,
  createTicketTierSchema,
  idSchema,
  paginationSchema,
  setEventStatusSchema,
  updateEventSchema,
  updateTicketTierSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { notImplemented } from "../stub";
import { permissionProcedure, publicProcedure } from "../trpc";

export const eventRouter = {
  /* ------------------------------ admin reads ----------------------------- */
  list: permissionProcedure("events:read")
    .input(paginationSchema)
    .query((): Promise<Paginated<Event>> => notImplemented("event.list")),

  byId: permissionProcedure("events:read")
    .input(byIdSchema)
    .query((): Promise<Event | null> => notImplemented("event.byId")),

  /* ----------------------------- public reads ----------------------------- */
  /** Published events for the landing page / events list. */
  publicList: publicProcedure.query(
    (): Promise<Event[]> => notImplemented("event.publicList"),
  ),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query((): Promise<Event | null> => notImplemented("event.bySlug")),

  /* ------------------------------- mutations ------------------------------ */
  create: permissionProcedure("events:write")
    .input(createEventSchema)
    .mutation((): Promise<Event> => notImplemented("event.create")),

  update: permissionProcedure("events:write")
    .input(updateEventSchema)
    .mutation((): Promise<Event> => notImplemented("event.update")),

  /** Publish / unpublish / end / cancel. */
  setStatus: permissionProcedure("events:write")
    .input(setEventStatusSchema)
    .mutation((): Promise<Event> => notImplemented("event.setStatus")),

  delete: permissionProcedure("events:delete")
    .input(byIdSchema)
    .mutation((): Promise<{ id: string }> => notImplemented("event.delete")),

  /** Attendee CSV export (returns CSV text). */
  attendeesCsv: permissionProcedure("events:read")
    .input(byIdSchema)
    .query((): Promise<string> => notImplemented("event.attendeesCsv")),

  /* ----------------------------- GA ticket tiers -------------------------- */
  /** Tiers for an event — public (checkout) with live sold/reserved/remaining. */
  tiersByEvent: publicProcedure
    .input(z.object({ eventId: idSchema }))
    .query((): Promise<TicketTier[]> => notImplemented("event.tiersByEvent")),

  createTier: permissionProcedure("events:write")
    .input(createTicketTierSchema)
    .mutation((): Promise<TicketTier> => notImplemented("event.createTier")),

  updateTier: permissionProcedure("events:write")
    .input(updateTicketTierSchema)
    .mutation((): Promise<TicketTier> => notImplemented("event.updateTier")),

  deleteTier: permissionProcedure("events:write")
    .input(byIdSchema)
    .mutation(
      (): Promise<{ id: string }> => notImplemented("event.deleteTier"),
    ),
} satisfies TRPCRouterRecord;
