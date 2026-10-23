import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { trpc } from "~/utils/api";

export type AuditRow = RouterOutputs["audit"]["list"]["items"][number];
export type AuditPage = RouterOutputs["audit"]["list"];

/** Query key prefix of the audit list (shared by list + detail lookup). */
export const auditListKey = () => trpc.audit.list.pathKey();

/**
 * Row from the in-memory list cache the user just tapped, used as initial data
 * for `audit.byId` so the detail screen opens instantly.
 */
export function findCachedAuditRow(
  queryClient: QueryClient,
  id: string,
): AuditRow | undefined {
  const entries = queryClient.getQueriesData<InfiniteData<AuditPage>>({
    queryKey: auditListKey(),
  });
  for (const [, data] of entries) {
    for (const page of data?.pages ?? []) {
      const hit = page.items.find((r) => r.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}
