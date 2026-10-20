/**
 * Seed the Super Admin user via better-auth (email + password), then promote
 * it to the Super Admin role. Run AFTER `pnpm -F @npa/db seed` (which creates
 * the roles). Wired into `pnpm db:seed` at the repo root.
 *
 * Lives in `packages/auth` (not `packages/db`) because creating a user with a
 * hashed password requires the better-auth server — keeping it here avoids a
 * db -> auth dependency cycle.
 *
 * Credentials come from env (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`)
 * with safe local defaults. Requires a live DATABASE_URL.
 */
import { eq } from "@npa/db";
import { db } from "@npa/db/client";
import { role, user } from "@npa/db/schema";

import { initAuth } from "../src/index";

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@nopetsallowed.test";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe!2026";
  const name = "Super Admin";

  const auth = initAuth({
    baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    productionUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
  });

  const superAdminRole = await db.query.role.findFirst({
    where: eq(role.name, "Super Admin"),
    columns: { id: true },
  });
  if (!superAdminRole) {
    throw new Error(
      "Super Admin role not found — run `pnpm -F @npa/db seed` first.",
    );
  }

  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
    columns: { id: true },
  });

  if (!existing) {
    await auth.api.signUpEmail({ body: { email, password, name } });
    console.log(`Created Super Admin user: ${email}`);
  } else {
    console.log(`Super Admin user already exists: ${email}`);
  }

  // The sign-up hook assigns the Customer role by default — promote it.
  // `role: "admin"` lets this user call the better-auth admin plugin endpoints.
  await db
    .update(user)
    .set({
      roleId: superAdminRole.id,
      role: "admin",
      emailVerified: true,
      banned: false,
    })
    .where(eq(user.email, email));

  console.log(
    `Super Admin ready (${email}). Change the password after first login.`,
  );
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
