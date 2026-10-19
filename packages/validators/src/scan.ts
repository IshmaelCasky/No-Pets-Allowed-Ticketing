import { z } from "zod/v4";

import { idSchema } from "./common";

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
