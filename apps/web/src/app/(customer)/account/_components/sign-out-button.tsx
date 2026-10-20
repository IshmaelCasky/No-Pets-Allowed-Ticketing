"use client";

import { useRouter } from "next/navigation";

import { toast } from "@npa/ui/toast";

import { authClient } from "~/auth/client";

export function SignOutButton() {
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-full border border-[oklch(0.35_0.02_310)] px-6 py-2.5 text-sm font-semibold transition-colors hover:border-[oklch(0.64_0.21_25)] hover:text-[oklch(0.72_0.19_25)]"
    >
      Sign out
    </button>
  );
}
