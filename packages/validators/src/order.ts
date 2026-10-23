import { z } from "zod/v4";

import { idSchema, paginationSchema } from "./common";
import { orderStatusSchema } from "./enums";

/**
 * Create order: pick ticket type(s) + quantity. `maxPerOrder` is enforced
 * server-side against the concert.
 */
export const orderLineSchema = z.object({
  tierId: idSchema,
  quantity: z.number().int().positive().max(50),
});

export const createOrderSchema = z.object({
  eventId: idSchema,
  items: z.array(orderLineSchema).min(1),
});
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
