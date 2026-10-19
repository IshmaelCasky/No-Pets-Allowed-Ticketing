import { z } from "zod/v4";

import { idSchema, paginationSchema } from "./common";

/** Audit log filters: actor / action / entity / date range. */
export const listAuditLogsSchema = paginationSchema.extend({
  actorId: idSchema.optional(),
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(120).optional(),
  entityId: idSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
