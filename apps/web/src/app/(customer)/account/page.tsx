import type { Metadata } from "next";
import Link from "next/link";

import { getSession } from "~/auth/server";
import { SignOutButton } from "./_components/sign-out-button";

export const metadata: Metadata = { title: "Account · No Pets Allowed" };

export default async function AccountPage() {
  // The customer layout already guarantees a session.
  const session = await getSession();
  const user = session?.user;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl">
        Account
      </h1>

      <div className="mt-8 space-y-4 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-6">
        <Row label="Name" value={user?.name} />
        <Row label="Email" value={user?.email} />
        <Row
          label="Phone"
          value={(user as { phone?: string | null } | undefined)?.phone ?? "—"}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/my-tickets"
          className="rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-5 transition-colors hover:border-[oklch(0.62_0.21_350)]"
        >
          <p className="font-bold">My tickets</p>
          <p className="text-sm text-[oklch(0.68_0.018_309)]">
            View and manage your tickets
          </p>
        </Link>
        <Link
          href="/refunds"
          className="rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-5 transition-colors hover:border-[oklch(0.62_0.21_350)]"
        >
          <p className="font-bold">Refunds</p>
          <p className="text-sm text-[oklch(0.68_0.018_309)]">
            Request and track refunds
          </p>
        </Link>
      </div>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-[oklch(0.3_0.018_310)]/60 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-[oklch(0.68_0.018_309)]">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}
