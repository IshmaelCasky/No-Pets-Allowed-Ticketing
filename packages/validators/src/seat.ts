import { z } from "zod/v4";

import { centavosSchema, idSchema } from "./common";
import { rowLabelStyleSchema } from "./enums";

/** Grid-builder section: a rows × seatsPerRow block, priced per section. */
export const createSeatSectionSchema = z.object({
  eventId: idSchema,
  name: z.string().trim().min(1).max(120),
  price: centavosSchema,
  rows: z.number().int().positive().max(100),
  seatsPerRow: z.number().int().positive().max(100),
  rowLabelStyle: rowLabelStyleSchema.default("alpha"),
  color: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color")
    .optional(),
  sortOrder: z.number().int().nonnegative().default(0),
});
export type CreateSeatSectionInput = z.infer<typeof createSeatSectionSchema>;

export const updateSeatSectionSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(120).optional(),
  price: centavosSchema.optional(),
  rowLabelStyle: rowLabelStyleSchema.optional(),
  color: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color")
    .optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type UpdateSeatSectionInput = z.infer<typeof updateSeatSectionSchema>;

/** Drag-to-reorder sections. */
export const reorderSeatSectionsSchema = z.object({
  eventId: idSchema,
  orderedSectionIds: z.array(idSchema).min(1),
});

/** Block / unblock individual seats (pillars, production, comps). */
export const setSeatsBlockedSchema = z.object({
  seatIds: z.array(idSchema).min(1),
  blocked: z.boolean(),
});
