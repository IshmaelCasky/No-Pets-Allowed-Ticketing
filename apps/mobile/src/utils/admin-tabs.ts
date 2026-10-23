import type { PermissionKey } from "@npa/validators";

/**
 * Bottom tabs of the staff/admin section (`src/app/admin`). A tab shows only
 * if the role has any one of its permission keys — same gating as the web
 * admin sidebar. "More" (always shown) lists Users, Roles, Audit Logs, Account.
 */
export const ADMIN_TABS: {
  name: "home" | "sales" | "events" | "gate";
  title: string;
  glyph: string;
  anyOf: readonly PermissionKey[];
}[] = [
  { name: "home", title: "Dashboard", glyph: "📊", anyOf: ["orders:read"] },
  {
    name: "sales",
    title: "Transactions",
    glyph: "🧾",
    anyOf: ["orders:read", "refunds:review"],
  },
  { name: "events", title: "Concerts", glyph: "🎵", anyOf: ["events:read"] },
  { name: "gate", title: "Gate", glyph: "📷", anyOf: ["tickets:scan"] },
];
