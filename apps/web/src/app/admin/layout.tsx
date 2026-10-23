import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";
import { AdminSidebar } from "./_components/sidebar";
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
    <div className="min-h-screen">
      <AdminSidebar
        permissions={me.permissions}
        userName={me.user.name}
        userEmail={me.user.email}
      />
      <main className="min-w-0 p-6 md:ml-60 lg:p-8">{props.children}</main>
    </div>
  );
}
