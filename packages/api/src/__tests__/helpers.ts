/**
 * Test harness for the DB-backed router tests.
 *
 * These tests need a REAL Postgres. They are destructive (they truncate app
 * tables between tests), so they run only when `TEST_DATABASE_URL` is set and
 * NEVER against the live `DATABASE_URL`. Callers should guard with
 * `describe.runIf(hasTestDb)` (see the test files).
 *
 * Run them with, e.g.:
 *   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/npa_test \
 *     pnpm -F @npa/api test
 */
import { randomUUID } from "node:crypto";

export const hasTestDb = !!process.env.TEST_DATABASE_URL;

// Point the db singleton at the test database BEFORE any @npa/* import that
// transitively imports `@npa/db/client` (which reads DATABASE_URL on load).
if (hasTestDb) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-non-null-assertion -- test harness needs loose typing around the dynamically-imported db */
type Any = any;

/** Lazily imported so the DATABASE_URL override above takes effect first. */
export async function getTestEnv() {
  const { db } = await import("@npa/db/client");
  const schema = await import("@npa/db/schema");
  const { eq, sql } = await import("@npa/db");
  const { appRouter } = await import("../root");
  const { createCallerFactory } = await import("../trpc");
  const createCaller = createCallerFactory(appRouter);
  return { db, schema, sql, eq, createCaller };
}

export type TestEnv = Awaited<ReturnType<typeof getTestEnv>>;

/**
 * Apply the committed migrations to the (empty) test database by executing the
 * generated `.sql` files in order. Avoids a direct drizzle-orm dependency in
 * this package (the migrator lives under `@npa/db`'s dependency tree).
 */
export async function migrate(env: TestEnv): Promise<void> {
  const { readdir, readFile } = await import("node:fs/promises");
  const dir = new URL("../../../db/drizzle", import.meta.url).pathname;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const raw = await readFile(`${dir}/${file}`, "utf8");
    // drizzle delimits statements with `--> statement-breakpoint`.
    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await env.db.execute(env.sql.raw(statement));
    }
  }
}

/** Truncate all app tables (keeps a clean slate between tests). */
export async function resetDb(env: TestEnv): Promise<void> {
  await env.db.execute(env.sql`
    truncate table
      "scan_log", "audit_log", "ticket", "order_item", "refund_request",
      "order", "ticket_tier",
      "event", "session", "account", "user", "role"
    restart identity cascade
  `);
}

/** Simulate a completed HitPay payment: fulfil the order (→ approved + tickets). */
export async function payOrder(env: TestEnv, orderId: string): Promise<void> {
  const { fulfillPaidOrderTx } = await import("../fulfill");
  await env.db.transaction((tx: Any) =>
    fulfillPaidOrderTx(tx, orderId, "completed"),
  );
}

/** Seed a role with the given permission keys; returns the role id. */
export async function seedRole(
  env: TestEnv,
  name: string,
  permissions: string[],
  isSystem = false,
): Promise<string> {
  const [row] = await env.db
    .insert(env.schema.role)
    .values({ name, permissions: permissions as Any, isSystem })
    .returning();
  return row!.id;
}

/** Insert a bare user row (no better-auth account needed for router tests). */
export async function seedUser(
  env: TestEnv,
  opts: { name?: string; roleId?: string | null; banned?: boolean } = {},
): Promise<string> {
  const id = randomUUID();
  await env.db.insert(env.schema.user).values({
    id,
    name: opts.name ?? "Test User",
    email: `${id}@test.local`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleId: opts.roleId ?? null,
    banned: opts.banned ?? false,
  });
  return id;
}

/** A minimal tRPC context for a caller acting as `userId`. */
export async function contextFor(env: TestEnv, userId: string | null) {
  const user = userId
    ? await env.db.query.user.findFirst({
        where: env.eq(env.schema.user.id, userId),
      })
    : null;
  return {
    db: env.db,
    session: user
      ? {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            roleId: user.roleId,
            banned: user.banned,
          },
          session: { id: "test-session", userId: user.id },
        }
      : null,
    authApi: {} as Any,
    ip: "127.0.0.1",
    userAgent: "vitest",
    headers: new Headers(),
  } as Any;
}

/** Build a caller acting as `userId` (or anonymous when null). */
export async function callerFor(env: TestEnv, userId: string | null) {
  return env.createCaller(await contextFor(env, userId));
}
