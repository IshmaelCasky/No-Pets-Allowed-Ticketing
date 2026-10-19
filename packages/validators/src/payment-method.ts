import { z } from "zod/v4";

import { idSchema } from "./common";

export const createPaymentMethodSchema = z.object({
  label: z.string().trim().min(1).max(120),
  accountName: z.string().trim().min(1).max(200),
  accountNumber: z.string().trim().min(1).max(120),
  qrImageUrl: z.string().url().max(2048).optional(),
  instructions: z.string().trim().max(2000).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
});
export type CreatePaymentMethodInput = z.infer<
  typeof createPaymentMethodSchema
>;

export const updatePaymentMethodSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).max(120).optional(),
  accountName: z.string().trim().min(1).max(200).optional(),
  accountNumber: z.string().trim().min(1).max(120).optional(),
  qrImageUrl: z.string().url().max(2048).optional(),
  instructions: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type UpdatePaymentMethodInput = z.infer<
  typeof updatePaymentMethodSchema
>;

export const reorderPaymentMethodsSchema = z.object({
  orderedIds: z.array(idSchema).min(1),
});
