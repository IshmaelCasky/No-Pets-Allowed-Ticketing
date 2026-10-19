import { z } from "zod/v4";

import { idSchema, paginationSchema } from "./common";

/** Admin creates a staff user and assigns a role. */
export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  phone: z.string().trim().max(32).optional(),
  roleId: idSchema,
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const assignUserRoleSchema = z.object({
  userId: idSchema,
  roleId: idSchema,
});
export type AssignUserRoleInput = z.infer<typeof assignUserRoleSchema>;

export const banUserSchema = z.object({
  userId: idSchema,
  reason: z.string().trim().min(1, "A ban reason is required").max(1000),
});
export type BanUserInput = z.infer<typeof banUserSchema>;

export const unbanUserSchema = z.object({ userId: idSchema });

export const resetUserPasswordSchema = z.object({
  userId: idSchema,
  password: z.string().min(8).max(128),
});
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export const listUsersSchema = paginationSchema.extend({
  roleId: idSchema.optional(),
  banned: z.boolean().optional(),
});
export type ListUsersInput = z.infer<typeof listUsersSchema>;
