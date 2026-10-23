import { z } from "zod/v4";

import { centavosSchema, idSchema } from "./common";

/** GA ticket tiers (price, capacity, sales window). */
export const createTicketTierSchema = z
  .object({
    eventId: idSchema,
    name: z.string().trim().min(1).max(120),
    price: centavosSchema,
    capacity: z.number().int().positive(),
    salesStartAt: z.coerce.date().optional(),
    salesEndAt: z.coerce.date().optional(),
    sortOrder: z.number().int().nonnegative().default(0),
    imageUrl: z.string().url().max(2048).optional(),
  })
  .refine(
    (v) => !v.salesStartAt || !v.salesEndAt || v.salesStartAt <= v.salesEndAt,
    { message: "Sales start must be before sales end", path: ["salesEndAt"] },
  );
export type CreateTicketTierInput = z.infer<typeof createTicketTierSchema>;

export const updateTicketTierSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120).optional(),
  price: centavosSchema.optional(),
  // Capacity cannot drop below reserved + sold — enforced in the API.
  capacity: z.number().int().positive().optional(),
  salesStartAt: z.coerce.date().optional(),
  salesEndAt: z.coerce.date().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url().max(2048).optional(),
});
export type UpdateTicketTierInput = z.infer<typeof updateTicketTierSchema>;
