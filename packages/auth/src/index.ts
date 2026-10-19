import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { eq } from "@npa/db";
import { db } from "@npa/db/client";
import { role } from "@npa/db/schema";

/**
 * Extra columns added to the better-auth `user` table (see packages/db schema).
 * `roleId` is assigned server-side on sign-up (defaults to the Customer role),
 * so it and the ban fields are not user-settable inputs.
 */
const userAdditionalFields = {
  phone: { type: "string", required: false, input: true },
  roleId: { type: "string", required: false, input: false },
  banned: { type: "boolean", required: false, input: false },
  banReason: { type: "string", required: false, input: false },
} as const;

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  extraPlugins?: TExtraPlugins;
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: userAdditionalFields,
    },
    databaseHooks: {
      user: {
        create: {
          // New sign-ups default to the Customer role.
          before: async (user) => {
            const [customer] = await db
              .select({ id: role.id })
              .from(role)
              .where(eq(role.name, "Customer"))
              .limit(1);
            return {
              data: {
                ...user,
                roleId: customer?.id ?? null,
                banned: false,
              },
            };
          },
        },
      },
    },
    plugins: [expo(), ...(options.extraPlugins ?? [])],
    trustedOrigins: ["npa://", "expo://"],
    onAPIError: {
      onError(error: unknown, ctx: unknown) {
        console.error("BETTER AUTH API ERROR", error, ctx);
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
