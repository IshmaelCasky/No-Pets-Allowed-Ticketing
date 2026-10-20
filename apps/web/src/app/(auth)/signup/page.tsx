import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account · No Pets Allowed" };

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight uppercase">
        Create account
      </h1>
      <p className="mt-1 text-sm text-[oklch(0.68_0.018_309)]">
        An account is required to buy tickets.
      </p>
      <Suspense>
        <SignupForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-[oklch(0.68_0.018_309)]">
        Already have one?{" "}
        <Link
          href="/login"
          className="font-semibold text-[oklch(0.72_0.17_348)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
