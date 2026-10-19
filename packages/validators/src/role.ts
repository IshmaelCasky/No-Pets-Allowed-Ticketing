import { z } from "zod/v4";

import { idSchema } from "./common";
import { permissionKeySchema } from "./enums";

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).optional(),
  permissions: z.array(permissionKeySchema).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  permissions: z.array(permissionKeySchema).optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
