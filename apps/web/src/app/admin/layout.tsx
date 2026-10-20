import { redirect } from "next/navigation";

import type { PermissionKey } from "@npa/validators";

import { getSession } from "~/auth/server";
import { AdminSidebar } from "./_components/sidebar";
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
    <div className="flex min-h-screen">
      <aside className="bg-card w-60 shrink-0 border-r">
        <div className="border-b px-6 py-4">
          <p className="text-sm font-bold tracking-tight">No Pets Allowed</p>
          <p className="text-muted-foreground text-xs">{me.user.name}</p>
        </div>
        <AdminSidebar permissions={me.permissions} />
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8">{props.children}</main>
    </div>
  );
}
