import type { TRPCRouterRecord } from "@trpc/server";

import type { Role } from "@npa/db/schema";
import {
  byIdSchema,
  createRoleSchema,
  updateRoleSchema,
} from "@npa/validators";

import { notImplemented } from "../stub";
import { permissionProcedure } from "../trpc";

/** A role plus how many users currently hold it. */
export interface RoleWithMemberCount extends Role {
  memberCount: number;
}

export const roleRouter = {
  /** Readable by anyone who manages users (needed for the assign-role picker). */
  list: permissionProcedure("users:read").query(
    (): Promise<RoleWithMemberCount[]> => notImplemented("role.list"),
  ),

  create: permissionProcedure("roles:write")
    .input(createRoleSchema)
    .mutation((): Promise<Role> => notImplemented("role.create")),

  /** System roles are locked; the last Super Admin can't be demoted (enforced in body). */
  update: permissionProcedure("roles:write")
    .input(updateRoleSchema)
    .mutation((): Promise<Role> => notImplemented("role.update")),

  delete: permissionProcedure("roles:write")
    .input(byIdSchema)
    .mutation((): Promise<{ id: string }> => notImplemented("role.delete")),
} satisfies TRPCRouterRecord;
