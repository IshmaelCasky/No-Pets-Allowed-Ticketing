"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { PermissionKey } from "@npa/validators";
import { cn } from "@npa/ui";
import { toast } from "@npa/ui/toast";

import { authClient } from "~/auth/client";

interface NavItem {
  href: string;
  label: string;
  /** Any one of these permissions grants access to the module. */
  anyOf: PermissionKey[];
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", anyOf: ["orders:read"] },
  { href: "/admin/users", label: "User Management", anyOf: ["users:read"] },
  { href: "/admin/roles", label: "Role Management", anyOf: ["roles:write"] },
  { href: "/admin/audit", label: "Audit Logs", anyOf: ["audit:read"] },
  {
    href: "/admin/events",
    label: "Concerts",
    anyOf: ["events:read", "events:write"],
  },
  {
    href: "/admin/transactions",
    label: "Transactions",
    anyOf: ["orders:read", "orders:review", "refunds:review"],
  },
  { href: "/admin/scanner", label: "QR Scanner", anyOf: ["tickets:scan"] },
];

export function AdminSidebar({
  permissions,
  userName,
  userEmail,
}: {
  permissions: PermissionKey[];
  userName: string;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const set = new Set(permissions);
  const items = NAV.filter((n) => n.anyOf.some((p) => set.has(p)));

  const signOut = async () => {
    await authClient.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="bg-card fixed inset-y-0 left-0 z-30 hidden w-60 shrink-0 flex-col border-r md:flex">
      {/* Brand */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin" className="text-sm font-bold tracking-tight">
          No Pets Allowed
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        <p className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
          Admin
        </p>
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 px-1">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            {userEmail && (
              <p className="text-muted-foreground truncate text-xs">
                {userEmail}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="hover:bg-accent hover:text-accent-foreground mt-3 w-full rounded-md border px-3 py-2 text-sm font-medium transition-colors"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
