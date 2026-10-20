import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";
import { SiteFooter } from "../(public)/_components/site-footer";
import { SiteNav } from "../(public)/_components/site-nav";

/**
 * Authenticated customer surfaces: checkout, pay/upload proof, My Tickets,
 * refunds, account. Account required — redirect to login (preserving where the
 * user was headed) when unauthenticated.
 */
export default async function CustomerLayout(props: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="dark flex min-h-screen flex-col bg-[oklch(0.16_0.012_312)] text-[oklch(0.97_0.006_308)]">
      <SiteNav />
      <main className="flex-1">{props.children}</main>
      <SiteFooter />
    </div>
  );
}
