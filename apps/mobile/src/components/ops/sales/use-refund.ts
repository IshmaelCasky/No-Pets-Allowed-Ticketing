import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { trpc, trpcClient } from "~/utils/api";

type Page = RouterOutputs["refund"]["queue"];
export type Refund = Page["items"][number];

function isPaged(data: unknown): data is InfiniteData<Page> {
  return (
    typeof data === "object" &&
    data !== null &&
    "pages" in data &&
    Array.isArray((data as { pages: unknown }).pages)
  );
}

/** Look the request up in any loaded page of the Refunds queue. */
function fromCache(queryClient: QueryClient, id: string): Refund | undefined {
  for (const [, data] of queryClient.getQueriesData({
    queryKey: trpc.refund.queue.pathKey(),
  })) {
    if (!isPaged(data)) continue;
    for (const page of data.pages) {
      const hit = page.items.find((r) => r.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Fallback (deep link / refresh): walk the queue until we find it. */
async function fetchRefund(id: string): Promise<Refund | null> {
  const pageSize = 100;
  for (let page = 1; page <= 20; page++) {
    const res = await trpcClient.refund.queue.query({ page, pageSize });
    const hit = res.items.find((r) => r.id === id);
    if (hit) return hit;
    if (page * pageSize >= res.total) break;
  }
  return null;
}

/**
 * One refund request for the detail screen. The API has no `refund.byId`, so
 * this seeds from the queue cache and refetches by walking the queue. Its key
 * sits under `refund.queue`, so invalidating the queue refreshes it too.
 */
export function useRefund(id: string) {
  const queryClient = useQueryClient();
  const queryKey = [...trpc.refund.queue.pathKey(), { byId: id }];
  const query = useQuery({
    queryKey,
    queryFn: () => fetchRefund(id),
    initialData: () => fromCache(queryClient, id),
  });
  return {
    ...query,
    /** Write a mutation's returned row straight into the detail view. */
    setRefund: (row: Refund) => queryClient.setQueryData(queryKey, row),
  };
}
