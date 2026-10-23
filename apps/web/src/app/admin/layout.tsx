import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";
import { AdminShell } from "./_components/admin-shell";
import { getAdminCaller } from "./_lib/caller";

export default async function AdminLayout(props: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const caller = await getAdminCaller();
  const me = await caller.auth.me();
  // Any role with at least one permission is staff (same rule as the
  // customer-storefront gate and the mobile app).
  if (me.permissions.length === 0) {
    redirect("/");
  }

  return (
    <AdminShell userName={me.user.name} permissions={me.permissions}>
      {props.children}
    </AdminShell>
  );
}
