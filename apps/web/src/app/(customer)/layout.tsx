import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";
import { SiteFooter } from "../(public)/_components/site-footer";
import { SiteNav } from "../(public)/_components/site-nav";
import { getCaller } from "../(public)/_lib/caller";

/**
 * Authenticated customer surfaces: checkout, pay, My Tickets, refunds, account.
 * - Account required — unauthenticated users go to /login.
 * - Customers only — staff/admin/dev accounts (any role granting permissions)
 *   are bounced to /admin so privileged accounts can't use the storefront.
 */
export default async function CustomerLayout(props: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const caller = await getCaller();
  const { permissions } = await caller.auth.me();
  if (permissions.length > 0) {
    redirect("/admin");
  }

  return (
    <div className="dark flex min-h-screen flex-col bg-[oklch(0.16_0.012_312)] text-[oklch(0.97_0.006_308)]">
      <SiteNav />
      <main className="flex-1">{props.children}</main>
      <SiteFooter />
    </div>
  );
}
