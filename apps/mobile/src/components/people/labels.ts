/**
 * Human labels for User / Role / Audit screens. Identifiers (permission keys,
 * entity types, audit actions) stay as-is; only what people read changes.
 * User-facing copy says "Concert" for the `event` resource.
 */
import type { PermissionKey, TicketStatus } from "@npa/validators";
import { PERMISSION_KEYS } from "@npa/validators";

import type { Tone } from "~/components/admin";

/** Labels for the `action` half of a permission key (mirrors the web). */
const PERMISSION_ACTION_LABELS: Record<string, string> = {
  read: "View",
  write: "Create / edit",
  delete: "Delete",
  review: "Review",
  scan: "Scan",
  void: "Void",
  ban: "Ban / unban",
};

/** Labels for the `resource` half of a permission key. */
const PERMISSION_RESOURCE_LABELS: Record<string, string> = {
  events: "Concerts",
  orders: "Orders",
  refunds: "Refunds",
  payment_methods: "Payment methods",
  tickets: "Tickets",
  users: "Users",
  roles: "Roles",
  audit: "Audit logs",
};

export function permissionActionLabel(key: PermissionKey): string {
  const action = key.split(":")[1] ?? key;
  return PERMISSION_ACTION_LABELS[action] ?? action;
}

export interface PermissionGroup {
  resource: string;
  label: string;
  keys: PermissionKey[];
}

/** Permission keys grouped by resource, in `PERMISSION_KEYS` order. */
export const PERMISSION_GROUPS: readonly PermissionGroup[] = (() => {
  const groups = new Map<string, PermissionKey[]>();
  for (const key of PERMISSION_KEYS) {
    const resource = key.split(":")[0] ?? key;
    const list = groups.get(resource) ?? [];
    list.push(key);
    groups.set(resource, list);
  }
  return [...groups.entries()].map(([resource, keys]) => ({
    resource,
    label: PERMISSION_RESOURCE_LABELS[resource] ?? resource,
    keys,
  }));
})();

/* ------------------------------ Audit ---------------------------------- */

/** Entity types written by `audit()` in the API (filter chips + labels). */
export const AUDIT_ENTITY_TYPES = [
  { value: "event", label: "Concert" },
  { value: "ticket_tier", label: "Ticket type" },
  { value: "seat_section", label: "Seat section" },
  { value: "seat", label: "Seat" },
  { value: "order", label: "Order" },
  { value: "refund_request", label: "Refund" },
  { value: "ticket", label: "Ticket" },
  { value: "user", label: "User" },
  { value: "role", label: "Role" },
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]["value"];

/**
 * Known audit actions per entity type, for quick filter chips. The free-text
 * action field still accepts anything (new actions just won't have a chip).
 */
export const AUDIT_ACTIONS: Record<AuditEntityType, readonly string[]> = {
  event: ["event.create", "event.update", "event.set_status", "event.delete"],
  ticket_tier: [
    "ticket_tier.create",
    "ticket_tier.update",
    "ticket_tier.delete",
  ],
  seat_section: [
    "seat_section.create",
    "seat_section.update",
    "seat_section.reorder",
    "seat_section.delete",
  ],
  seat: [],
  order: ["order.create", "order.paid", "order.cancel"],
  refund_request: [
    "refund.request",
    "refund.approve",
    "refund.reject",
    "refund.pay",
  ],
  ticket: ["ticket.void"],
  user: [
    "user.create",
    "user.assign_role",
    "user.ban",
    "user.unban",
    "user.reset_password",
  ],
  role: ["role.create", "role.update", "role.delete"],
};

const ENTITY_LABEL = new Map<string, string>(
  AUDIT_ENTITY_TYPES.map((e) => [e.value, e.label]),
);
/** Action prefixes that differ from the entity type (`refund.*`). */
const ACTION_PREFIX_LABEL: Record<string, string> = { refund: "Refund" };

const sentence = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function entityTypeLabel(entityType: string): string {
  return ENTITY_LABEL.get(entityType) ?? sentence(entityType);
}

/** `event.set_status` → "Concert · set status". */
export function auditActionLabel(action: string): string {
  const dot = action.indexOf(".");
  if (dot < 0) return sentence(action);
  const prefix = action.slice(0, dot);
  const verb = action.slice(dot + 1).replace(/_/g, " ");
  const subject =
    ACTION_PREFIX_LABEL[prefix] ?? ENTITY_LABEL.get(prefix) ?? sentence(prefix);
  return `${subject} · ${verb}`;
}

/** Tone by verb so creates/deletes stand out in the list. */
export function auditActionTone(action: string): Tone {
  const verb = action.slice(action.indexOf(".") + 1);
  if (/delete|ban$|void|reject|cancel/.test(verb) && verb !== "unban")
    return "red";
  if (/create|approve|paid|pay|unban/.test(verb)) return "green";
  if (/assign_role|reset_password|set_status/.test(verb)) return "amber";
  return "blue";
}

/* ------------------------------ Tickets -------------------------------- */
export const TICKET_TONE: Record<TicketStatus, Tone> = {
  active: "green",
  used: "blue",
  void: "gray",
};

export function titleCase(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
