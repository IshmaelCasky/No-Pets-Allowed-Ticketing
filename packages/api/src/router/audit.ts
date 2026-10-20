import type { TRPCRouterRecord } from "@trpc/server";

import type { SQL } from "@npa/db";
import type { AuditLog } from "@npa/db/schema";
import { and, count, desc, eq, gte, lte } from "@npa/db";
import { auditLog, user } from "@npa/db/schema";
import { listAuditLogsSchema } from "@npa/validators";

import type { Paginated } from "../stub";
import { toCsv } from "../lib";
import { permissionProcedure } from "../trpc";

/** An audit row with the actor's display name resolved for the table. */
export interface AuditLogRow extends AuditLog {
  actorName: string | null;
}

function buildFilters(input: {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): SQL[] {
  const filters: SQL[] = [];
  if (input.actorId) filters.push(eq(auditLog.actorId, input.actorId));
  if (input.action) filters.push(eq(auditLog.action, input.action));
  if (input.entityType) filters.push(eq(auditLog.entityType, input.entityType));
  if (input.entityId) filters.push(eq(auditLog.entityId, input.entityId));
  if (input.dateFrom) filters.push(gte(auditLog.createdAt, input.dateFrom));
  if (input.dateTo) filters.push(lte(auditLog.createdAt, input.dateTo));
  return filters;
}

export const auditRouter = {
  list: permissionProcedure("audit:read")
    .input(listAuditLogsSchema)
    .query(async ({ ctx, input }): Promise<Paginated<AuditLogRow>> => {
      const filters = buildFilters(input);
      const where = filters.length ? and(...filters) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [rows, [totalRow]] = await Promise.all([
        ctx.db
          .select({
            log: auditLog,
            actorName: user.name,
          })
          .from(auditLog)
          .leftJoin(user, eq(auditLog.actorId, user.id))
          .where(where)
          .orderBy(desc(auditLog.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ value: count() }).from(auditLog).where(where),
      ]);
      return {
        items: rows.map((r) => ({ ...r.log, actorName: r.actorName })),
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** CSV export of the filtered audit log. */
  exportCsv: permissionProcedure("audit:read")
    .input(listAuditLogsSchema)
    .query(async ({ ctx, input }): Promise<string> => {
      const filters = buildFilters(input);
      const where = filters.length ? and(...filters) : undefined;
      const rows = await ctx.db
        .select({ log: auditLog, actorName: user.name })
        .from(auditLog)
        .leftJoin(user, eq(auditLog.actorId, user.id))
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(10000);

      const header = [
        "When",
        "Actor",
        "Action",
        "Entity Type",
        "Entity Id",
        "Before",
        "After",
        "IP",
      ];
      const body = rows.map((r) => [
        r.log.createdAt.toISOString(),
        r.actorName ?? r.log.actorId ?? "",
        r.log.action,
        r.log.entityType,
        r.log.entityId ?? "",
        r.log.before ? JSON.stringify(r.log.before) : "",
        r.log.after ? JSON.stringify(r.log.after) : "",
        r.log.ip ?? "",
      ]);
      return toCsv([header, ...body]);
    }),
} satisfies TRPCRouterRecord;
