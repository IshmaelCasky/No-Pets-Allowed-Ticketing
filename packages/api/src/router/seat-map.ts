import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { Seat, SeatSection } from "@npa/db/schema";
import {
  byIdSchema,
  createSeatSectionSchema,
  idSchema,
  reorderSeatSectionsSchema,
  setSeatsBlockedSchema,
  updateSeatSectionSchema,
} from "@npa/validators";

import { notImplemented } from "../stub";
import { permissionProcedure, publicProcedure } from "../trpc";

export const seatMapRouter = {
  /**
   * Full seat map for an event: sections + seats with live status. Used by the
   * customer seat picker (polled) and the admin grid builder.
   */
  forEvent: publicProcedure
    .input(z.object({ eventId: idSchema }))
    .query(
      (): Promise<{ sections: SeatSection[]; seats: Seat[] }> =>
        notImplemented("seatMap.forEvent"),
    ),

  createSection: permissionProcedure("events:write")
    .input(createSeatSectionSchema)
    .mutation(
      (): Promise<SeatSection> => notImplemented("seatMap.createSection"),
    ),

  updateSection: permissionProcedure("events:write")
    .input(updateSeatSectionSchema)
    .mutation(
      (): Promise<SeatSection> => notImplemented("seatMap.updateSection"),
    ),

  deleteSection: permissionProcedure("events:write")
    .input(byIdSchema)
    .mutation(
      (): Promise<{ id: string }> => notImplemented("seatMap.deleteSection"),
    ),

  reorderSections: permissionProcedure("events:write")
    .input(reorderSeatSectionsSchema)
    .mutation(
      (): Promise<{ success: true }> =>
        notImplemented("seatMap.reorderSections"),
    ),

  /** Block / unblock individual seats (pillars, production, comps). */
  setSeatsBlocked: permissionProcedure("events:write")
    .input(setSeatsBlockedSchema)
    .mutation((): Promise<Seat[]> => notImplemented("seatMap.setSeatsBlocked")),
} satisfies TRPCRouterRecord;
