"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { PermissionKey } from "@npa/validators";
import { cn } from "@npa/ui";

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
  { href: "/admin/scans", label: "Scans", anyOf: ["tickets:scan"] },
];

export function AdminSidebar({
  permissions,
}: {
  permissions: PermissionKey[];
}) {
  const pathname = usePathname();
  const set = new Set(permissions);
  const items = NAV.filter((n) => n.anyOf.some((p) => set.has(p)));

  return (
    <nav className="flex flex-col gap-1 p-4">
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
  );
}
