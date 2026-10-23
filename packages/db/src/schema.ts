import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export * from "./auth-schema";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** cuid2 text primary key. */
const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => createId());

/** timestamptz, stored UTC. */
const tz = () => timestamp({ withTimezone: true });

const createdAt = () => tz().notNull().defaultNow();

/* -------------------------------------------------------------------------- */
/*  Enums                                                                     */
/* -------------------------------------------------------------------------- */

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "for_review",
  "approved",
  "rejected",
  "expired",
  "cancelled",
  "refunded",
]);

export const ticketStatus = pgEnum("ticket_status", ["active", "used", "void"]);

export const seatStatus = pgEnum("seat_status", [
  "available",
  "held",
  "sold",
  "blocked",
]);

export const eventStatus = pgEnum("event_status", [
  "draft",
  "published",
  "ended",
  "cancelled",
]);

export const seatingMode = pgEnum("seating_mode", ["ga", "reserved"]);

export const refundStatus = pgEnum("refund_status", [
  "requested",
  "approved",
  "rejected",
  "paid",
]);

export const scanResult = pgEnum("scan_result", [
  "valid",
  "already_used",
  "wrong_event",
  "void",
  "not_found",
]);

export const rowLabelStyle = pgEnum("row_label_style", ["alpha", "numeric"]);

/* -------------------------------------------------------------------------- */
/*  Permissions                                                               */
/* -------------------------------------------------------------------------- */

/** All permission keys (`resource:action`). Code checks keys, never role names. */
export const PERMISSIONS = [
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

export type Permission = (typeof PERMISSIONS)[number];

/* -------------------------------------------------------------------------- */
/*  role                                                                      */
/* -------------------------------------------------------------------------- */

export const role = pgTable("role", (t) => ({
  id: id(),
  name: t.text().notNull().unique(),
  description: t.text(),
  permissions: t
    .text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`)
    .$type<Permission[]>(),
  isSystem: t.boolean().notNull().default(false),
  createdAt: createdAt(),
}));

/* -------------------------------------------------------------------------- */
/*  event                                                                     */
/* -------------------------------------------------------------------------- */

export const event = pgTable(
  "event",
  (t) => ({
    id: id(),
    slug: t.text().notNull().unique(),
    title: t.text().notNull(),
    lineup: t.text(),
    venue: t.text(),
    startsAt: tz(),
    doorsOpenAt: tz(),
    posterUrl: t.text(),
    description: t.text(),
    status: eventStatus().notNull().default("draft"),
    maxPerOrder: t.integer().notNull().default(4),
    refundCutoffDays: t.integer().notNull().default(7),
    createdAt: createdAt(),
  }),
  (table) => [
    index("event_status_idx").on(table.status),
    index("event_starts_at_idx").on(table.startsAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  ticket_tier (GA events)                                                   */
/* -------------------------------------------------------------------------- */

export const ticketTier = pgTable(
  "ticket_tier",
  (t) => ({
    id: id(),
    eventId: t
      .text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    name: t.text().notNull(),
    price: t.integer().notNull(),
    capacity: t.integer().notNull(),
    reserved: t.integer().notNull().default(0),
    sold: t.integer().notNull().default(0),
    salesStartAt: tz(),
    salesEndAt: tz(),
    sortOrder: t.integer().notNull().default(0),
    // Optional artwork for this ticket type (shown on checkout + the ticket).
    imageUrl: t.text(),
    createdAt: createdAt(),
  }),
  (table) => [
    index("ticket_tier_event_id_idx").on(table.eventId),
    check("ticket_tier_inventory_check", sql`${table.reserved} >= 0`),
    check("ticket_tier_sold_check", sql`${table.sold} >= 0`),
    check(
      "ticket_tier_capacity_check",
      sql`${table.reserved} + ${table.sold} <= ${table.capacity}`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/*  order                                                                     */
/* -------------------------------------------------------------------------- */

export const order = pgTable(
  "order",
  (t) => ({
    id: id(),
    code: t.text().notNull().unique(),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    eventId: t
      .text()
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    status: orderStatus().notNull().default("pending_payment"),
    totalAmount: t.integer().notNull(),
    // HitPay payment gateway. Set when the payment request is created; the
    // webhook flips the order to approved and records paidAt.
    hitpayPaymentId: t.text(),
    hitpayStatus: t.text(),
    paidAt: tz(),
    expiresAt: tz(),
    createdAt: createdAt(),
  }),
  (table) => [
    index("order_user_id_idx").on(table.userId),
    index("order_event_id_idx").on(table.eventId),
    index("order_status_idx").on(table.status),
    index("order_hitpay_payment_id_idx").on(table.hitpayPaymentId),
    index("order_created_at_idx").on(table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  order_item                                                                */
/* -------------------------------------------------------------------------- */

export const orderItem = pgTable(
  "order_item",
  (t) => ({
    id: id(),
    orderId: t
      .text()
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    tierId: t
      .text()
      .notNull()
      .references(() => ticketTier.id, { onDelete: "restrict" }),
    quantity: t.integer().notNull(),
    unitPrice: t.integer().notNull(),
    createdAt: createdAt(),
  }),
  (table) => [
    index("order_item_order_id_idx").on(table.orderId),
    index("order_item_tier_id_idx").on(table.tierId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  ticket                                                                    */
/* -------------------------------------------------------------------------- */

export const ticket = pgTable(
  "ticket",
  (t) => ({
    id: id(),
    orderId: t
      .text()
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    eventId: t
      .text()
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    tierId: t
      .text()
      .notNull()
      .references(() => ticketTier.id, { onDelete: "restrict" }),
    holderName: t.text(),
    token: t.text().notNull().unique(),
    status: ticketStatus().notNull().default("active"),
    usedAt: tz(),
    usedById: t.text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  }),
  (table) => [
    index("ticket_order_id_idx").on(table.orderId),
    index("ticket_event_id_idx").on(table.eventId),
    index("ticket_tier_id_idx").on(table.tierId),
    index("ticket_status_idx").on(table.status),
    index("ticket_used_by_id_idx").on(table.usedById),
  ],
);

/* -------------------------------------------------------------------------- */
/*  refund_request                                                            */
/* -------------------------------------------------------------------------- */

export const refundRequest = pgTable(
  "refund_request",
  (t) => ({
    id: id(),
    orderId: t
      .text()
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reason: t.text().notNull(),
    payoutMethod: t.text().notNull(),
    payoutAccountName: t.text().notNull(),
    payoutAccountNumber: t.text().notNull(),
    status: refundStatus().notNull().default("requested"),
    reviewedById: t.text().references(() => user.id, { onDelete: "set null" }),
    reviewedAt: tz(),
    rejectionReason: t.text(),
    payoutReference: t.text(),
    payoutProofKey: t.text(),
    paidAt: tz(),
    createdAt: createdAt(),
  }),
  (table) => [
    index("refund_request_order_id_idx").on(table.orderId),
    index("refund_request_user_id_idx").on(table.userId),
    index("refund_request_status_idx").on(table.status),
    index("refund_request_reviewed_by_id_idx").on(table.reviewedById),
    // One open request per order.
    uniqueIndex("refund_request_open_order_unique")
      .on(table.orderId)
      .where(sql`${table.status} in ('requested', 'approved')`),
  ],
);

/* -------------------------------------------------------------------------- */
/*  scan_log                                                                  */
/* -------------------------------------------------------------------------- */

export const scanLog = pgTable(
  "scan_log",
  (t) => ({
    id: id(),
    ticketId: t.text().references(() => ticket.id, { onDelete: "set null" }),
    eventId: t
      .text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    scannedById: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    rawValue: t.text().notNull(),
    result: scanResult().notNull(),
    device: t.text(),
    createdAt: createdAt(),
  }),
  (table) => [
    index("scan_log_ticket_id_idx").on(table.ticketId),
    index("scan_log_event_id_idx").on(table.eventId),
    index("scan_log_scanned_by_id_idx").on(table.scannedById),
    index("scan_log_result_idx").on(table.result),
    index("scan_log_created_at_idx").on(table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  audit_log                                                                 */
/* -------------------------------------------------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  (t) => ({
    id: id(),
    actorId: t.text().references(() => user.id, { onDelete: "set null" }),
    action: t.text().notNull(),
    entityType: t.text().notNull(),
    entityId: t.text(),
    before: jsonb(),
    after: jsonb(),
    ip: t.text(),
    userAgent: t.text(),
    createdAt: createdAt(),
  }),
  (table) => [
    index("audit_log_actor_id_idx").on(table.actorId),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_entity_type_idx").on(table.entityType),
    index("audit_log_entity_id_idx").on(table.entityId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*  user.roleId foreign key                                                   */
/*  Declared here (not in auth-schema) to avoid a circular import with role.  */
/* -------------------------------------------------------------------------- */

export const userRelations = relations(user, ({ one, many }) => ({
  role: one(role, {
    fields: [user.roleId],
    references: [role.id],
  }),
  orders: many(order),
  refundRequests: many(refundRequest),
}));

/* -------------------------------------------------------------------------- */
/*  Relations                                                                 */
/* -------------------------------------------------------------------------- */

export const roleRelations = relations(role, ({ many }) => ({
  users: many(user),
}));

export const eventRelations = relations(event, ({ many }) => ({
  ticketTiers: many(ticketTier),
  orders: many(order),
  tickets: many(ticket),
  scanLogs: many(scanLog),
}));

export const ticketTierRelations = relations(ticketTier, ({ one, many }) => ({
  event: one(event, {
    fields: [ticketTier.eventId],
    references: [event.id],
  }),
  orderItems: many(orderItem),
  tickets: many(ticket),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
  user: one(user, {
    fields: [order.userId],
    references: [user.id],
  }),
  event: one(event, {
    fields: [order.eventId],
    references: [event.id],
  }),
  items: many(orderItem),
  tickets: many(ticket),
  refundRequests: many(refundRequest),
}));

export const orderItemRelations = relations(orderItem, ({ one }) => ({
  order: one(order, {
    fields: [orderItem.orderId],
    references: [order.id],
  }),
  tier: one(ticketTier, {
    fields: [orderItem.tierId],
    references: [ticketTier.id],
  }),
}));

export const ticketRelations = relations(ticket, ({ one }) => ({
  order: one(order, {
    fields: [ticket.orderId],
    references: [order.id],
  }),
  event: one(event, {
    fields: [ticket.eventId],
    references: [event.id],
  }),
  tier: one(ticketTier, {
    fields: [ticket.tierId],
    references: [ticketTier.id],
  }),
  usedBy: one(user, {
    fields: [ticket.usedById],
    references: [user.id],
  }),
}));

export const refundRequestRelations = relations(refundRequest, ({ one }) => ({
  order: one(order, {
    fields: [refundRequest.orderId],
    references: [order.id],
  }),
  user: one(user, {
    fields: [refundRequest.userId],
    references: [user.id],
    relationName: "refund_requester",
  }),
  reviewedBy: one(user, {
    fields: [refundRequest.reviewedById],
    references: [user.id],
    relationName: "refund_reviewer",
  }),
}));

export const scanLogRelations = relations(scanLog, ({ one }) => ({
  ticket: one(ticket, {
    fields: [scanLog.ticketId],
    references: [ticket.id],
  }),
  event: one(event, {
    fields: [scanLog.eventId],
    references: [event.id],
  }),
  scannedBy: one(user, {
    fields: [scanLog.scannedById],
    references: [user.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, {
    fields: [auditLog.actorId],
    references: [user.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/*  Inferred types                                                            */
/* -------------------------------------------------------------------------- */

export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;
export type Event = typeof event.$inferSelect;
export type NewEvent = typeof event.$inferInsert;
export type TicketTier = typeof ticketTier.$inferSelect;
export type NewTicketTier = typeof ticketTier.$inferInsert;
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type OrderItem = typeof orderItem.$inferSelect;
export type NewOrderItem = typeof orderItem.$inferInsert;
export type Ticket = typeof ticket.$inferSelect;
export type NewTicket = typeof ticket.$inferInsert;
export type RefundRequest = typeof refundRequest.$inferSelect;
export type NewRefundRequest = typeof refundRequest.$inferInsert;
export type ScanLog = typeof scanLog.$inferSelect;
export type NewScanLog = typeof scanLog.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
