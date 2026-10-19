import type { TRPCRouterRecord } from "@trpc/server";

import type { AuditLog } from "@npa/db/schema";
import { listAuditLogsSchema } from "@npa/validators";

import type { Paginated } from "../stub";
import { notImplemented } from "../stub";
import { permissionProcedure } from "../trpc";

/** An audit row with the actor's display name resolved for the table. */
export interface AuditLogRow extends AuditLog {
  actorName: string | null;
}

export const auditRouter = {
  list: permissionProcedure("audit:read")
    .input(listAuditLogsSchema)
    .query((): Promise<Paginated<AuditLogRow>> => notImplemented("audit.list")),

  /** CSV export of the filtered audit log. */
  exportCsv: permissionProcedure("audit:read")
    .input(listAuditLogsSchema)
    .query((): Promise<string> => notImplemented("audit.exportCsv")),
} satisfies TRPCRouterRecord;
