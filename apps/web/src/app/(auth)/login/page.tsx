import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · No Pets Allowed" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight uppercase">Sign in</h1>
      <p className="mt-1 text-sm text-[oklch(0.68_0.018_309)]">
        Welcome back. Your tickets are waiting.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-[oklch(0.68_0.018_309)]">
        New here?{" "}
        <Link
          href="/signup"
          className="font-semibold text-[oklch(0.72_0.17_348)] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
