import type { TRPCRouterRecord } from "@trpc/server";

import type { PermissionKey } from "@npa/validators";
import { eq } from "@npa/db";
import { role } from "@npa/db/schema";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  /** Current user plus the permission keys granted by their role. */
  me: protectedProcedure.query(
    async ({
      ctx,
    }): Promise<{
      user: { id: string; name: string; email: string };
      permissions: PermissionKey[];
    }> => {
      const sessionUser = ctx.session.user as typeof ctx.session.user & {
        roleId?: string | null;
      };
      const roleRow = sessionUser.roleId
        ? await ctx.db.query.role.findFirst({
            where: eq(role.id, sessionUser.roleId),
            columns: { permissions: true },
          })
        : null;
      return {
        user: {
          id: sessionUser.id,
          name: sessionUser.name,
          email: sessionUser.email,
        },
        permissions: roleRow?.permissions ?? [],
      };
    },
  ),
} satisfies TRPCRouterRecord;
