import { z } from "zod/v4";

import { idSchema, paginationSchema } from "./common";
import { scanResultSchema } from "./enums";

/**
 * A scan: the scanner has selected an event, then reads a QR (rawValue is the
 * encoded `ticket.token`) or types a code manually. Every scan is logged.
 */
export const scanTicketSchema = z.object({
  eventId: idSchema,
  rawValue: z.string().trim().min(1).max(512),
  device: z.string().trim().max(200).optional(),
});
export type ScanTicketInput = z.infer<typeof scanTicketSchema>;

/* ---------------------------- Scans module ------------------------------- */

/** Check-ins tab filter: everyone, only arrived, or only not-yet-arrived. */
export const CHECKIN_FILTERS = ["all", "checked_in", "not_checked_in"] as const;
export const checkinFilterSchema = z.enum(CHECKIN_FILTERS);
export type CheckinFilter = z.infer<typeof checkinFilterSchema>;

/**
 * Check-ins tab: every live (non-void) ticket for one event with its arrival
 * state. `search` matches holder / buyer name, buyer email, order code.
 */
export const listCheckinsSchema = paginationSchema.extend({
  eventId: idSchema,
  status: checkinFilterSchema.default("all"),
});
export type ListCheckinsInput = z.infer<typeof listCheckinsSchema>;

/**
 * Scan log tab: every scan attempt, including failures. All filters optional.
 * `search` matches holder / buyer name, buyer email, order code.
 */
export const listScanLogsSchema = paginationSchema.extend({
  eventId: idSchema.optional(),
  result: scanResultSchema.optional(),
  scannedById: idSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListScanLogsInput = z.infer<typeof listScanLogsSchema>;
