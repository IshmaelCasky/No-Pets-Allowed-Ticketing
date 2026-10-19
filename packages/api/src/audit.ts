import type { db } from "@npa/db/client";
import { auditLog } from "@npa/db/schema";

/**
 * Minimal context shape the audit helper needs. The real tRPC context (and the
 * cron caller context) both satisfy this.
 */
export interface AuditContext {
  db: typeof db;
  session: { user: { id: string } } | null;
  ip: string | null;
  userAgent: string | null;
}

/** A db handle or an open transaction — both expose `.insert`. */
type Executor = Pick<typeof db, "insert">;

export interface AuditEntry {
  /** `entity.verb`, e.g. `order.approve`, `payment_method.update`, `user.ban`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Append an audit-log row. Call inside the SAME transaction as the mutation it
 * records by passing the transaction as `tx`. Audit logs are append-only — we
 * never update or delete them (see CLAUDE.md "Audit logging").
 */
export async function audit(
  ctx: AuditContext,
  entry: AuditEntry,
  tx?: Executor,
): Promise<void> {
  const exec = tx ?? ctx.db;
  await exec.insert(auditLog).values({
    actorId: ctx.session?.user.id ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
