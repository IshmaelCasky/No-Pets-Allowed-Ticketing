import { z } from "zod/v4";

import { idSchema } from "./common";
import { eventStatusSchema } from "./enums";

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a lowercase kebab-case slug");

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: slugSchema,
    lineup: z.string().trim().max(2000).optional(),
    venue: z.string().trim().min(1).max(200),
    startsAt: z.coerce.date(),
    doorsOpenAt: z.coerce.date().optional(),
    posterUrl: z.string().url().max(2048).optional(),
    description: z.string().trim().max(10000).optional(),
    status: eventStatusSchema.default("draft"),
    maxPerOrder: z.number().int().positive().max(50).default(4),
    refundCutoffDays: z.number().int().nonnegative().max(365).default(7),
  })
  .refine((v) => !v.doorsOpenAt || v.doorsOpenAt <= v.startsAt, {
    message: "Doors must open at or before the show starts",
    path: ["doorsOpenAt"],
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

/** Update: id + any subset of the editable fields. */
export const updateEventSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200).optional(),
  slug: slugSchema.optional(),
  lineup: z.string().trim().max(2000).optional(),
  venue: z.string().trim().min(1).max(200).optional(),
  startsAt: z.coerce.date().optional(),
  doorsOpenAt: z.coerce.date().optional(),
  posterUrl: z.string().url().max(2048).optional(),
  description: z.string().trim().max(10000).optional(),
  status: eventStatusSchema.optional(),
  maxPerOrder: z.number().int().positive().max(50).optional(),
  refundCutoffDays: z.number().int().nonnegative().max(365).optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const setEventStatusSchema = z.object({
  id: idSchema,
  status: eventStatusSchema,
});
