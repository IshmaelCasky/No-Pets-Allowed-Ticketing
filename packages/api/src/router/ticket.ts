import type { TRPCRouterRecord } from "@trpc/server";

import type { Ticket } from "@npa/db/schema";
import {
  byIdSchema,
  updateTicketHolderSchema,
  voidTicketSchema,
} from "@npa/validators";

import { notImplemented } from "../stub";
import { permissionProcedure, protectedProcedure } from "../trpc";

export const ticketRouter = {
  /** Current user's tickets (grouped by status in the UI). */
  myTickets: protectedProcedure.query(
    (): Promise<Ticket[]> => notImplemented("ticket.myTickets"),
  ),

  byId: protectedProcedure
    .input(byIdSchema)
    .query((): Promise<Ticket | null> => notImplemented("ticket.byId")),

  /** Editable holder name per ticket. */
  updateHolder: protectedProcedure
    .input(updateTicketHolderSchema)
    .mutation((): Promise<Ticket> => notImplemented("ticket.updateHolder")),

  /** Admin void (e.g. part of a refund). */
  void: permissionProcedure("tickets:void")
    .input(voidTicketSchema)
    .mutation((): Promise<Ticket> => notImplemented("ticket.void")),
} satisfies TRPCRouterRecord;
