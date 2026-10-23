"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import type { PermissionKey } from "@npa/validators";
import { cn } from "@npa/ui";

import { AdminSidebar } from "./sidebar";

/**
 * Admin frame. Desktop (md+): fixed left sidebar. Phones: a top bar with a
 * Menu button that opens the same nav as a panel, closed on navigation.
 */
export function AdminShell({
  userName,
  permissions,
  children,
}: {
  userName: string;
  permissions: PermissionKey[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so it closes on navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const toggle = () => setOpenOn(open ? null : pathname);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Phone top bar */}
      <header
        className="bg-card sticky z-30 flex items-center justify-between border-b px-4 py-3 md:hidden"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight">No Pets Allowed</p>
          <p className="text-muted-foreground truncate text-xs">{userName}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>
      <div
        id="admin-mobile-nav"
        className={cn(
          "bg-card sticky top-[57px] z-20 border-b md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <AdminSidebar permissions={permissions} />
      </div>

      {/* Desktop sidebar */}
      <aside className="bg-card hidden w-60 shrink-0 border-r md:block">
        <div className="border-b px-6 py-4">
          <p className="text-sm font-bold tracking-tight">No Pets Allowed</p>
          <p className="text-muted-foreground text-xs">{userName}</p>
        </div>
        <AdminSidebar permissions={permissions} />
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
