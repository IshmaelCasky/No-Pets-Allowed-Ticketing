import type { TRPCRouterRecord } from "@trpc/server";

import { and, count, eq, gte, sql, sum } from "@npa/db";
import { event, order, ticket } from "@npa/db/schema";

import { permissionProcedure } from "../trpc";

export interface DashboardSummary {
  pendingReviewCount: number;
  approvedRevenue: number; // centavos
  checkInsToday: number;
  ticketsSoldByEvent: {
    eventId: string;
    eventTitle: string;
    ticketsSold: number;
  }[];
}

export const dashboardRouter = {
  /** Admin dashboard metrics. */
  summary: permissionProcedure("orders:read").query(
    async ({ ctx }): Promise<DashboardSummary> => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [[pendingRow], [revenueRow], [checkInRow], soldRows] =
        await Promise.all([
          ctx.db
            .select({ value: count() })
            .from(order)
            .where(eq(order.status, "for_review")),
          ctx.db
            .select({ value: sum(order.totalAmount) })
            .from(order)
            .where(eq(order.status, "approved")),
          ctx.db
            .select({ value: count() })
            .from(ticket)
            .where(
              and(eq(ticket.status, "used"), gte(ticket.usedAt, startOfToday)),
            ),
          ctx.db
            .select({
              eventId: event.id,
              eventTitle: event.title,
              ticketsSold: count(ticket.id),
            })
            .from(event)
            .leftJoin(
              ticket,
              and(
                eq(ticket.eventId, event.id),
                sql`${ticket.status} <> 'void'`,
              ),
            )
            .groupBy(event.id, event.title),
        ]);

      return {
        pendingReviewCount: pendingRow?.value ?? 0,
        approvedRevenue: Number(revenueRow?.value ?? 0),
        checkInsToday: checkInRow?.value ?? 0,
        ticketsSoldByEvent: soldRows.map((r) => ({
          eventId: r.eventId,
          eventTitle: r.eventTitle,
          ticketsSold: r.ticketsSold,
        })),
      };
    },
  ),
} satisfies TRPCRouterRecord;
