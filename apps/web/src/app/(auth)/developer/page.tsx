import type { Metadata } from "next";
import { Suspense } from "react";

import { ClaimAccount } from "../_components/claim-account";

export const metadata: Metadata = {
  title: "Developer setup · No Pets Allowed",
};

export default function DeveloperPage() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight uppercase">
        Developer setup
      </h1>
      <p className="mt-1 text-sm text-[oklch(0.68_0.018_250)]">
        One-time setup for the developer. Create the Developer account (full
        access). This page locks permanently once the account exists.
      </p>
      <Suspense>
        <ClaimAccount kind="developer" label="Developer" />
      </Suspense>
    </div>
  );
}
