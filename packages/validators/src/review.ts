import { z } from "zod/v4";

import { idSchema, paginationSchema } from "./common";

/** Payment review queue (oldest first) — filter to a single event optionally. */
export const reviewQueueSchema = paginationSchema.extend({
  eventId: idSchema.optional(),
});

export const approveOrderSchema = z.object({ orderId: idSchema });

export const rejectOrderSchema = z.object({
  orderId: idSchema,
  reason: z.string().trim().min(1, "A rejection reason is required").max(1000),
});
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
