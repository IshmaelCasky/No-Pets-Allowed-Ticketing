import type { TRPCRouterRecord } from "@trpc/server";

import type { PermissionKey } from "@npa/validators";

import { notImplemented } from "../stub";
import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  /** Current user plus the permission keys granted by their role. */
  me: protectedProcedure.query(
    (): Promise<{
      user: { id: string; name: string; email: string };
      permissions: PermissionKey[];
    }> => notImplemented("auth.me"),
  ),
} satisfies TRPCRouterRecord;
