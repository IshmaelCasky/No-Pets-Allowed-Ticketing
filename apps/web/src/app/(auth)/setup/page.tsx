import type { Metadata } from "next";
import { Suspense } from "react";

import { ClaimAccount } from "../_components/claim-account";

export const metadata: Metadata = { title: "Admin setup · No Pets Allowed" };

export default function SetupPage() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight uppercase">
        Super Admin setup
      </h1>
      <p className="mt-1 text-sm text-[oklch(0.68_0.018_250)]">
        One-time setup for the owner. Create the Super Admin account to take
        over the dashboard. This page locks permanently once the account exists.
      </p>
      <Suspense>
        <ClaimAccount kind="super_admin" label="Super Admin" />
      </Suspense>
    </div>
  );
}
