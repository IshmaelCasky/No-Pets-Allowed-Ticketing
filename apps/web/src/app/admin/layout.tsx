import { redirect } from "next/navigation";

import type { PermissionKey } from "@npa/validators";

import { getSession } from "~/auth/server";
import { AdminShell } from "./_components/admin-shell";
import { getAdminCaller } from "./_lib/caller";

/** Permissions that grant access to at least one admin module. */
const ADMIN_PERMISSIONS: PermissionKey[] = [
  "events:read",
  "events:write",
  "orders:read",
  "orders:review",
  "refunds:review",
  "payment_methods:write",
  "tickets:scan",
  "users:read",
  "roles:write",
  "audit:read",
];

export default async function AdminLayout(props: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const caller = await getAdminCaller();
  const me = await caller.auth.me();
  const hasAnyAdmin = me.permissions.some((p) => ADMIN_PERMISSIONS.includes(p));
  if (!hasAnyAdmin) {
    redirect("/");
  }

  return (
    <AdminShell userName={me.user.name} permissions={me.permissions}>
      {props.children}
    </AdminShell>
  );
}
