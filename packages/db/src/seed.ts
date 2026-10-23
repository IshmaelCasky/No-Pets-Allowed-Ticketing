import type { Permission } from "./schema";
import { db } from "./client";
import { PERMISSIONS, role } from "./schema";

/**
 * Idempotent seed: the 5 system/staff roles.
 *
 * Payment methods are no longer seeded — payments go through HitPay, not manual
 * QR methods. The Super Admin *user* is created by the lead via better-auth to
 * avoid a db -> auth dependency cycle.
 */

const ALL: Permission[] = [...PERMISSIONS];

const ROLES: {
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}[] = [
  {
    name: "Super Admin",
    description: "Full access. System role, undeletable.",
    permissions: ALL,
    isSystem: true,
  },
  {
    name: "Developer",
    description:
      "Full access for the developer. System role, claimed once via /developer.",
    permissions: ALL,
    isSystem: true,
  },
  {
    name: "Admin",
    description: "Full access except role management.",
    permissions: ALL.filter((p) => p !== "roles:write"),
    isSystem: false,
  },
  {
    name: "Staff",
    description: "Review orders & refunds, scan tickets.",
    permissions: [
      "orders:read",
      "orders:review",
      "refunds:review",
      "tickets:scan",
    ],
    isSystem: false,
  },
  {
    name: "Scanner",
    description: "Scan tickets at the gate.",
    permissions: ["tickets:scan"],
    isSystem: false,
  },
  {
    name: "Customer",
    description: "Default role for sign-ups. No admin access.",
    permissions: [],
    isSystem: true,
  },
];

async function main() {
  // Roles — upsert keyed on unique `name`.
  for (const r of ROLES) {
    await db
      .insert(role)
      .values({
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: r.isSystem,
      })
      .onConflictDoUpdate({
        target: role.name,
        set: {
          description: r.description,
          permissions: r.permissions,
          isSystem: r.isSystem,
        },
      });
    console.log(`  role: ${r.name} (${r.permissions.length} permissions)`);
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
