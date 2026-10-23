"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient } from "~/auth/client";
import { accent } from "../_theme/tokens";

const LINKS = [
  { href: "/events", label: "Concerts" },
  { href: "/#how-to-buy", label: "How to buy" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * Top nav shared by all customer surfaces. Shows account links when signed in,
 * sign-in CTA otherwise. Reads the session on the client so it stays live after
 * login/logout without a full reload.
 */
export function SiteNav() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-[oklch(0.3_0.018_310)]/70 bg-[oklch(0.16_0.012_312)]/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-black tracking-tight uppercase">
            No Pets <span className={accent.text}>Allowed</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[oklch(0.78_0.012_309)] transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {!isPending && session?.user ? (
            <>
              <Link
                href="/my-tickets"
                className="hidden text-[oklch(0.78_0.012_309)] transition-colors hover:text-white sm:inline"
              >
                My tickets
              </Link>
              <Link
                href="/account"
                className="rounded-full border border-[oklch(0.35_0.02_310)] px-4 py-1.5 font-semibold transition-colors hover:border-[oklch(0.62_0.21_350)]"
              >
                {session.user.name.split(" ")[0] ?? "Account"}
              </Link>
            </>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              className="rounded-full bg-[oklch(0.62_0.21_350)] px-4 py-1.5 font-bold text-white transition-colors hover:bg-[oklch(0.68_0.2_349)]"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
