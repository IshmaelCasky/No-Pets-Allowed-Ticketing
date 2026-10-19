import { eq } from "drizzle-orm";

import type { Permission } from "./schema";
import { db } from "./client";
import { paymentMethod, PERMISSIONS, role } from "./schema";

/**
 * Idempotent seed: 5 system/staff roles + default (inactive) payment methods.
 *
 * The Super Admin *user* is intentionally NOT created here — user creation is
 * handled by the lead via better-auth to avoid a db -> auth dependency cycle.
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

const PAYMENT_METHODS: {
  label: string;
  accountName: string;
  accountNumber: string;
  sortOrder: number;
}[] = [
  {
    label: "GCash",
    accountName: "No Pets Allowed",
    accountNumber: "0000000000",
    sortOrder: 0,
  },
  {
    label: "Maya",
    accountName: "No Pets Allowed",
    accountNumber: "0000000000",
    sortOrder: 1,
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

  // Payment methods — no unique constraint on label, so check-then-insert.
  for (const pm of PAYMENT_METHODS) {
    const existing = await db
      .select({ id: paymentMethod.id })
      .from(paymentMethod)
      .where(eq(paymentMethod.label, pm.label))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(paymentMethod).values({
        label: pm.label,
        accountName: pm.accountName,
        accountNumber: pm.accountNumber,
        qrImageUrl: null,
        instructions: null,
        isActive: false,
        sortOrder: pm.sortOrder,
      });
      console.log(`  payment method: ${pm.label} (created, inactive)`);
    } else {
      console.log(`  payment method: ${pm.label} (exists, skipped)`);
    }
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
