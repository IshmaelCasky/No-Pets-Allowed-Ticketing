import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { count, eq } from "@npa/db";
import { role, user } from "@npa/db/schema";
import { claimAccountSchema } from "@npa/validators";

import { audit } from "../audit";
import { publicProcedure } from "../trpc";

const ROLE_NAME = {
  super_admin: "Super Admin",
  developer: "Developer",
} as const;

/** How many users currently hold the named role. */
async function holderCount(
  db: typeof import("@npa/db/client").db,
  roleName: string,
): Promise<number> {
  const r = await db.query.role.findFirst({
    where: eq(role.name, roleName),
    columns: { id: true },
  });
  if (!r) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(user)
    .where(eq(user.roleId, r.id));
  return row?.n ?? 0;
}

/**
 * One-time privileged-account setup. `/setup` claims the single Super Admin
 * (client handover) and `/developer` claims the single Developer account. Once
 * a role has a holder, the claim is rejected — the routes lock permanently.
 * This gate is enforced here on the server; the pages only mirror it.
 */
export const setupRouter = {
  status: publicProcedure.query(
    async ({
      ctx,
    }): Promise<{ superAdminClaimed: boolean; developerClaimed: boolean }> => {
      const [sa, dev] = await Promise.all([
        holderCount(ctx.db, ROLE_NAME.super_admin),
        holderCount(ctx.db, ROLE_NAME.developer),
      ]);
      return { superAdminClaimed: sa > 0, developerClaimed: dev > 0 };
    },
  ),

  claim: publicProcedure
    .input(claimAccountSchema)
    .mutation(async ({ ctx, input }): Promise<{ ok: true }> => {
      const roleName = ROLE_NAME[input.kind];
      const r = await ctx.db.query.role.findFirst({
        where: eq(role.name, roleName),
        columns: { id: true },
      });
      if (!r) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `The ${roleName} role is missing — seed roles first`,
        });
      }

      // One-time: reject once the account exists (the permanent lock).
      if ((await holderCount(ctx.db, roleName)) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `The ${roleName} account has already been set up`,
        });
      }

      // Create via better-auth (public email sign-up), then promote. Sign-up
      // throws if the email is already taken.
      await ctx.authApi.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
        },
      });

      const [promoted] = await ctx.db
        .update(user)
        .set({
          roleId: r.id,
          role: "admin",
          emailVerified: true,
          banned: false,
        })
        .where(eq(user.email, input.email))
        .returning();
      if (!promoted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await audit(ctx, {
        action: `account.claim_${input.kind}`,
        entityType: "user",
        entityId: promoted.id,
        after: { roleId: promoted.roleId, role: promoted.role },
      });

      return { ok: true };
    }),
} satisfies TRPCRouterRecord;
