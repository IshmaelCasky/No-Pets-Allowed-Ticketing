/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type { Auth } from "@npa/auth";
import type { PermissionKey } from "@npa/validators";
import { eq } from "@npa/db";
import { db } from "@npa/db/client";
import { role } from "@npa/db/schema";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */

export const createTRPCContext = async (opts: {
  headers: Headers;
  auth: Auth;
}) => {
  const authApi = opts.auth.api;
  const session = await authApi.getSession({
    headers: opts.headers,
  });

  // Captured for audit-log rows (actor IP / user agent).
  const ip =
    opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    opts.headers.get("x-real-ip") ??
    null;
  const userAgent = opts.headers.get("user-agent") ?? null;

  return {
    authApi,
    session,
    db,
    ip,
    userAgent,
    // Forwarded to better-auth admin-plugin endpoints (createUser,
    // setUserPassword, …) so they run as the acting admin.
    headers: opts.headers,
  };
};
/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an articifial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev 100-500ms
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * Create a server-side caller — used by the Vercel cron route and tests to
 * invoke procedures without an HTTP round-trip.
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Load the permission keys granted to a user's role. Returns an empty set for
 * users with no role (e.g. fresh Customers before role assignment).
 */
async function getUserPermissions(roleId: string | null | undefined) {
  if (!roleId) return new Set<string>();
  const row = await db.query.role.findFirst({
    where: eq(role.id, roleId),
    columns: { permissions: true },
  });
  return new Set(row?.permissions ?? []);
}

/**
 * Permission-gated procedure. Code checks permission KEYS, never role names
 * (see CLAUDE.md "Roles & permissions"). Banned users are always rejected.
 * Injects `ctx.permissions` (the full granted set) and a non-null `ctx.user`.
 *
 * @example permissionProcedure("orders:review").mutation(...)
 */
export const permissionProcedure = (required: PermissionKey) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    const user = ctx.session.user as typeof ctx.session.user & {
      roleId?: string | null;
      banned?: boolean | null;
    };

    if (user.banned) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Account is banned" });
    }

    const permissions = await getUserPermissions(user.roleId);
    if (!permissions.has(required)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${required}`,
      });
    }

    return next({ ctx: { permissions, user } });
  });
