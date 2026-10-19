import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { ScanLog, Ticket } from "@npa/db/schema";
import type { ScanResult } from "@npa/validators";
import { idSchema, paginationSchema, scanTicketSchema } from "@npa/validators";

import type { Paginated } from "../stub";
import { notImplemented } from "../stub";
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
    .mutation((): Promise<ScanResponse> => notImplemented("scan.scan")),

  history: permissionProcedure("tickets:scan")
    .input(paginationSchema.extend({ eventId: idSchema }))
    .query((): Promise<Paginated<ScanLog>> => notImplemented("scan.history")),

  /** Live check-in counter for an event. */
  checkInCount: permissionProcedure("tickets:scan")
    .input(z.object({ eventId: idSchema }))
    .query(
      (): Promise<{ checkedIn: number; total: number }> =>
        notImplemented("scan.checkInCount"),
    ),
} satisfies TRPCRouterRecord;
