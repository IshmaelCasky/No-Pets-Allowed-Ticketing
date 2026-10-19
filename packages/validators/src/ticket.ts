import { z } from "zod/v4";

import { idSchema } from "./common";

/** Holder name is optional; defaults to buyer name, editable per ticket. */
export const updateTicketHolderSchema = z.object({
  ticketId: idSchema,
  holderName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type UpdateTicketHolderInput = z.infer<typeof updateTicketHolderSchema>;

export const voidTicketSchema = z.object({
  ticketId: idSchema,
  reason: z.string().trim().max(1000).optional(),
});
export type VoidTicketInput = z.infer<typeof voidTicketSchema>;
