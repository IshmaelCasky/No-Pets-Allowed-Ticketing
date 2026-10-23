import { z } from "zod/v4";

import { idSchema, paginationSchema } from "./common";
import { orderStatusSchema } from "./enums";

/**
 * Create order. Shape depends on the event's seating mode:
 * - GA: pick tier(s) + quantity.
 * - Reserved: pick exact seats.
 * `maxPerOrder` is enforced server-side against the event.
 */
export const gaOrderLineSchema = z.object({
  tierId: idSchema,
  quantity: z.number().int().positive().max(50),
});

export const createOrderSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ga"),
    eventId: idSchema,
    items: z.array(gaOrderLineSchema).min(1),
  }),
  z.object({
    mode: z.literal("reserved"),
    eventId: idSchema,
    seatIds: z.array(idSchema).min(1).max(50),
  }),
]);
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const cancelOrderSchema = z.object({
  id: idSchema,
  note: z.string().trim().max(1000).optional(),
});

export const listOrdersSchema = paginationSchema.extend({
  status: orderStatusSchema.optional(),
  eventId: idSchema.optional(),
});
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
