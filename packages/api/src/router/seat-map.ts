import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { NewSeat, Seat, SeatSection } from "@npa/db/schema";
import { and, asc, eq, inArray } from "@npa/db";
import { seat, seatSection } from "@npa/db/schema";
import {
  byIdSchema,
  createSeatSectionSchema,
  idSchema,
  reorderSeatSectionsSchema,
  setSeatsBlockedSchema,
  updateSeatSectionSchema,
} from "@npa/validators";

import { audit } from "../audit";
import { rowLabelFor, seatLabel } from "../lib";
import { permissionProcedure, publicProcedure } from "../trpc";

/** Build the full seat list for a section from its grid dimensions. */
function buildSeats(section: SeatSection): NewSeat[] {
  const seats: NewSeat[] = [];
  for (let r = 0; r < section.rows; r++) {
    const rowLabel = rowLabelFor(r, section.rowLabelStyle);
    for (let n = 1; n <= section.seatsPerRow; n++) {
      seats.push({
        sectionId: section.id,
        eventId: section.eventId,
        rowLabel,
        number: n,
        label: seatLabel(section.name, rowLabel, n),
      });
    }
  }
  return seats;
}

export const seatMapRouter = {
  forEvent: publicProcedure
    .input(z.object({ eventId: idSchema }))
    .query(
      async ({
        ctx,
        input,
      }): Promise<{ sections: SeatSection[]; seats: Seat[] }> => {
        const [sections, seats] = await Promise.all([
          ctx.db
            .select()
            .from(seatSection)
            .where(eq(seatSection.eventId, input.eventId))
            .orderBy(asc(seatSection.sortOrder)),
          ctx.db
            .select()
            .from(seat)
            .where(eq(seat.eventId, input.eventId))
            .orderBy(asc(seat.rowLabel), asc(seat.number)),
        ]);
        return { sections, seats };
      },
    ),

  createSection: permissionProcedure("events:write")
    .input(createSeatSectionSchema)
    .mutation(async ({ ctx, input }): Promise<SeatSection> => {
      return ctx.db.transaction(async (tx) => {
        const [section] = await tx
          .insert(seatSection)
          .values(input)
          .returning();
        if (!section) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await tx.insert(seat).values(buildSeats(section));
        await audit(
          ctx,
          {
            action: "seat_section.create",
            entityType: "seat_section",
            entityId: section.id,
            after: section,
          },
          tx,
        );
        return section;
      });
    }),

  /** Update section meta. Dimensions/labels only regenerate if no seat held/sold. */
  updateSection: permissionProcedure("events:write")
    .input(updateSeatSectionSchema)
    .mutation(async ({ ctx, input }): Promise<SeatSection> => {
      const { id, ...patch } = input;
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.seatSection.findFirst({
          where: eq(seatSection.id, id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });

        const labelStyleChanged =
          patch.rowLabelStyle !== undefined &&
          patch.rowLabelStyle !== before.rowLabelStyle;
        const nameChanged =
          patch.name !== undefined && patch.name !== before.name;

        // Regenerating labels is only safe if no seat is held/sold.
        if (labelStyleChanged || nameChanged) {
          const [committed] = await tx
            .select({ id: seat.id })
            .from(seat)
            .where(
              and(
                eq(seat.sectionId, id),
                inArray(seat.status, ["held", "sold"]),
              ),
            )
            .limit(1);
          if (committed) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Cannot relabel seats while some are held or sold in this section",
            });
          }
        }

        const [row] = await tx
          .update(seatSection)
          .set(patch)
          .where(eq(seatSection.id, id))
          .returning();
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        // Regenerate seat labels in place when name/label style changed.
        if (labelStyleChanged || nameChanged) {
          const existing = await tx
            .select()
            .from(seat)
            .where(eq(seat.sectionId, id));
          for (const s of existing) {
            const rowIndex = Number.isNaN(Number(s.rowLabel))
              ? s.rowLabel.charCodeAt(0) - 65
              : Number(s.rowLabel) - 1;
            const newRowLabel = rowLabelFor(rowIndex, row.rowLabelStyle);
            await tx
              .update(seat)
              .set({
                rowLabel: newRowLabel,
                label: seatLabel(row.name, newRowLabel, s.number),
              })
              .where(eq(seat.id, s.id));
          }
        }

        await audit(
          ctx,
          {
            action: "seat_section.update",
            entityType: "seat_section",
            entityId: id,
            before,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  deleteSection: permissionProcedure("events:write")
    .input(byIdSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.seatSection.findFirst({
          where: eq(seatSection.id, input.id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        const [committed] = await tx
          .select({ id: seat.id })
          .from(seat)
          .where(
            and(
              eq(seat.sectionId, input.id),
              inArray(seat.status, ["held", "sold"]),
            ),
          )
          .limit(1);
        if (committed) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Cannot delete a section with held or sold seats",
          });
        }
        await tx.delete(seatSection).where(eq(seatSection.id, input.id));
        await audit(
          ctx,
          {
            action: "seat_section.delete",
            entityType: "seat_section",
            entityId: input.id,
            before,
          },
          tx,
        );
        return { id: input.id };
      });
    }),

  reorderSections: permissionProcedure("events:write")
    .input(reorderSeatSectionsSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: true }> => {
      await ctx.db.transaction(async (tx) => {
        let i = 0;
        for (const sectionId of input.orderedSectionIds) {
          await tx
            .update(seatSection)
            .set({ sortOrder: i })
            .where(
              and(
                eq(seatSection.id, sectionId),
                eq(seatSection.eventId, input.eventId),
              ),
            );
          i++;
        }
        await audit(
          ctx,
          {
            action: "seat_section.reorder",
            entityType: "event",
            entityId: input.eventId,
            after: { orderedSectionIds: input.orderedSectionIds },
          },
          tx,
        );
      });
      return { success: true };
    }),

  setSeatsBlocked: permissionProcedure("events:write")
    .input(setSeatsBlockedSchema)
    .mutation(async ({ ctx, input }): Promise<Seat[]> => {
      return ctx.db.transaction(async (tx) => {
        // Only available <-> blocked transitions are allowed.
        const fromStatus = input.blocked ? "available" : "blocked";
        const toStatus = input.blocked ? "blocked" : "available";
        const rows = await tx
          .update(seat)
          .set({ status: toStatus })
          .where(
            and(inArray(seat.id, input.seatIds), eq(seat.status, fromStatus)),
          )
          .returning();
        if (rows.length !== input.seatIds.length) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Some seats could not be changed (only available ↔ blocked is allowed)",
          });
        }
        await audit(
          ctx,
          {
            action: input.blocked ? "seat.block" : "seat.unblock",
            entityType: "seat",
            entityId: input.seatIds[0] ?? null,
            after: { seatIds: input.seatIds, blocked: input.blocked },
          },
          tx,
        );
        return rows;
      });
    }),
} satisfies TRPCRouterRecord;
