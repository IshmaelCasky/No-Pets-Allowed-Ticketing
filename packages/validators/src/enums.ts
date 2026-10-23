import { z } from "zod/v4";

/**
 * Enum literal unions mirroring the Postgres enums defined in `@npa/db` schema
 * and the Domain rules in CLAUDE.md. Kept here (not imported from the DB) so
 * forms and API inputs can validate without pulling in the Drizzle/pg layer.
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "for_review",
  "approved",
  "rejected",
  "expired",
  "cancelled",
  "refunded",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const TICKET_STATUSES = ["active", "used", "void"] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const EVENT_STATUSES = [
  "draft",
  "published",
  "ended",
  "cancelled",
] as const;
export const eventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const REFUND_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "paid",
] as const;
export const refundStatusSchema = z.enum(REFUND_STATUSES);
export type RefundStatus = z.infer<typeof refundStatusSchema>;

export const SCAN_RESULTS = [
  "valid",
  "already_used",
  "wrong_event",
  "void",
  "not_found",
] as const;
export const scanResultSchema = z.enum(SCAN_RESULTS);
export type ScanResult = z.infer<typeof scanResultSchema>;

/**
 * Permission keys (`resource:action`). Code checks these keys, never role
 * names. Keep in sync with CLAUDE.md "Roles & permissions".
 */
export const PERMISSION_KEYS = [
  "events:read",
  "events:write",
  "events:delete",
  "orders:read",
  "orders:review",
  "refunds:review",
  "payment_methods:write",
  "tickets:scan",
  "tickets:void",
  "users:read",
  "users:write",
  "users:ban",
  "roles:write",
  "audit:read",
] as const;
export const permissionKeySchema = z.enum(PERMISSION_KEYS);
export type PermissionKey = z.infer<typeof permissionKeySchema>;
