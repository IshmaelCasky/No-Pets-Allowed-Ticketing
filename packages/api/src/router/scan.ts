import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { ScanLog, Ticket } from "@npa/db/schema";
import type { ScanResult } from "@npa/validators";
import { and, count, desc, eq } from "@npa/db";
import { scanLog, ticket, user } from "@npa/db/schema";
import { idSchema, paginationSchema, scanTicketSchema } from "@npa/validators";

import type { Paginated } from "../stub";
import { permissionProcedure } from "../trpc";

/** Outcome of a scan. `already_used` includes when and by whom. */
export interface ScanResponse {
  result: ScanResult;
  ticket: Ticket | null;
  usedAt: Date | null;
  usedByName: string | null;
}

export const scanRouter = {
  /** Validate a scanned QR / manual code for the selected event. Always logged. */
  scan: permissionProcedure("tickets:scan")
    .input(scanTicketSchema)
    .mutation(async ({ ctx, input }): Promise<ScanResponse> => {
      return ctx.db.transaction(async (tx) => {
        // Lock the ticket row so two gates can't both mark it used.
        const [found] = await tx
          .select()
          .from(ticket)
          .where(eq(ticket.token, input.rawValue))
          .for("update");

        const writeLog = async (
          result: ScanResult,
          ticketId: string | null,
        ) => {
          await tx.insert(scanLog).values({
            ticketId,
            eventId: input.eventId,
            scannedById: ctx.user.id,
            rawValue: input.rawValue,
            result,
            device: input.device ?? null,
          });
        };

        if (!found) {
          await writeLog("not_found", null);
          return {
            result: "not_found",
            ticket: null,
            usedAt: null,
            usedByName: null,
          };
        }
        if (found.eventId !== input.eventId) {
          await writeLog("wrong_event", found.id);
          return {
            result: "wrong_event",
            ticket: found,
            usedAt: null,
            usedByName: null,
          };
        }
        if (found.status === "void") {
          await writeLog("void", found.id);
          return {
            result: "void",
            ticket: found,
            usedAt: null,
            usedByName: null,
          };
        }
        if (found.status === "used") {
          await writeLog("already_used", found.id);
          const usedBy = found.usedById
            ? await tx.query.user.findFirst({
                where: eq(user.id, found.usedById),
                columns: { name: true },
              })
            : null;
          return {
            result: "already_used",
            ticket: found,
            usedAt: found.usedAt,
            usedByName: usedBy?.name ?? null,
          };
        }

        // active + right event → mark used.
        const usedAt = new Date();
        const [updated] = await tx
          .update(ticket)
          .set({ status: "used", usedAt, usedById: ctx.user.id })
          .where(and(eq(ticket.id, found.id), eq(ticket.status, "active")))
          .returning();
        if (!updated) {
          // Lost the race — re-report as already used.
          await writeLog("already_used", found.id);
          return {
            result: "already_used",
            ticket: found,
            usedAt: found.usedAt,
            usedByName: null,
          };
        }
        await writeLog("valid", updated.id);
        return {
          result: "valid",
          ticket: updated,
          usedAt,
          usedByName: ctx.user.name,
        };
      });
    }),

  history: permissionProcedure("tickets:scan")
    .input(paginationSchema.extend({ eventId: idSchema }))
    .query(async ({ ctx, input }): Promise<Paginated<ScanLog>> => {
      const where = eq(scanLog.eventId, input.eventId);
      const offset = (input.page - 1) * input.pageSize;
      const [items, [totalRow]] = await Promise.all([
        ctx.db
          .select()
          .from(scanLog)
          .where(where)
          .orderBy(desc(scanLog.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ value: count() }).from(scanLog).where(where),
      ]);
      return {
        items,
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** Live check-in counter for an event. */
  checkInCount: permissionProcedure("tickets:scan")
    .input(z.object({ eventId: idSchema }))
    .query(
      async ({ ctx, input }): Promise<{ checkedIn: number; total: number }> => {
        const [[usedRow], [totalRow]] = await Promise.all([
          ctx.db
            .select({ value: count() })
            .from(ticket)
            .where(
              and(eq(ticket.eventId, input.eventId), eq(ticket.status, "used")),
            ),
          ctx.db
            .select({ value: count() })
            .from(ticket)
            .where(
              and(
                eq(ticket.eventId, input.eventId),
                // sold/active + used count toward the total; void does not.
                eq(ticket.status, "active"),
              ),
            ),
        ]);
        // total = active + used (non-void live tickets).
        const checkedIn = usedRow?.value ?? 0;
        const active = totalRow?.value ?? 0;
        return { checkedIn, total: active + checkedIn };
      },
    ),
} satisfies TRPCRouterRecord;
