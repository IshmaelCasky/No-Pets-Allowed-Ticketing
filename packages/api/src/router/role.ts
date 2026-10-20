import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import type { Role } from "@npa/db/schema";
import { asc, count, eq } from "@npa/db";
import { role, user } from "@npa/db/schema";
import {
  byIdSchema,
  createRoleSchema,
  updateRoleSchema,
} from "@npa/validators";

import { audit } from "../audit";
import { permissionProcedure } from "../trpc";

/** A role plus how many users currently hold it. */
export interface RoleWithMemberCount extends Role {
  memberCount: number;
}

export const roleRouter = {
  /** Readable by anyone who manages users (needed for the assign-role picker). */
  list: permissionProcedure("users:read").query(
    async ({ ctx }): Promise<RoleWithMemberCount[]> => {
      const roles = await ctx.db.select().from(role).orderBy(asc(role.name));
      const counts = await ctx.db
        .select({ roleId: user.roleId, value: count() })
        .from(user)
        .groupBy(user.roleId);
      const byId = new Map(counts.map((c) => [c.roleId, c.value]));
      return roles.map((r) => ({ ...r, memberCount: byId.get(r.id) ?? 0 }));
    },
  ),

  create: permissionProcedure("roles:write")
    .input(createRoleSchema)
    .mutation(async ({ ctx, input }): Promise<Role> => {
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(role)
          .values({
            name: input.name,
            description: input.description ?? null,
            permissions: input.permissions,
            isSystem: false,
          })
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "role.create",
            entityType: "role",
            entityId: row.id,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  /** System roles are locked; the last Super Admin can't be demoted (enforced in body). */
  update: permissionProcedure("roles:write")
    .input(updateRoleSchema)
    .mutation(async ({ ctx, input }): Promise<Role> => {
      const { id, ...patch } = input;
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.role.findFirst({
          where: eq(role.id, id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        if (before.isSystem) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "System roles cannot be modified",
          });
        }
        const [row] = await tx
          .update(role)
          .set({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.description !== undefined
              ? { description: patch.description }
              : {}),
            ...(patch.permissions !== undefined
              ? { permissions: patch.permissions }
              : {}),
          })
          .where(eq(role.id, id))
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "role.update",
            entityType: "role",
            entityId: id,
            before,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  delete: permissionProcedure("roles:write")
    .input(byIdSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.role.findFirst({
          where: eq(role.id, input.id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        if (before.isSystem) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "System roles cannot be deleted",
          });
        }
        const [{ value: members } = { value: 0 }] = await tx
          .select({ value: count() })
          .from(user)
          .where(eq(user.roleId, input.id));
        if (members > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Reassign members before deleting this role",
          });
        }
        await tx.delete(role).where(eq(role.id, input.id));
        await audit(
          ctx,
          {
            action: "role.delete",
            entityType: "role",
            entityId: input.id,
            before,
          },
          tx,
        );
        return { id: input.id };
      });
    }),
} satisfies TRPCRouterRecord;
