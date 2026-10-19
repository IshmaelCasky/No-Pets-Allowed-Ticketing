import type { TRPCRouterRecord } from "@trpc/server";

import { notImplemented } from "../stub";
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
    (): Promise<DashboardSummary> => notImplemented("dashboard.summary"),
  ),
} satisfies TRPCRouterRecord;
