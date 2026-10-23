import type { QueryKey } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";

/** Shape every server-paginated admin list returns (`Paginated<T>` in the API). */
export interface PageOf<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Infinite-scroll wrapper for the API's page-numbered admin lists.
 *
 * Build `queryKey` from the procedure's `pathKey()` so the usual
 * `queryClient.invalidateQueries(trpc.x.y.queryFilter())` also refreshes it:
 *
 * @example
 * const input = { eventId, result };
 * const list = usePagedList(
 *   [...trpc.scan.logs.pathKey(), input],
 *   (page) => trpcClient.scan.logs.query({ ...input, page }),
 * );
 * <FlatList data={list.items} onEndReached={list.loadMore} … />
 */
export function usePagedList<
  TItem = unknown,
  TPage extends PageOf<TItem> = PageOf<TItem>,
>(
  queryKey: QueryKey,
  fetchPage: (page: number) => Promise<TPage>,
  options?: { enabled?: boolean },
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: options?.enabled ?? true,
  });
  const pages = query.data?.pages ?? [];
  return {
    ...query,
    /** All loaded rows across pages (typed from the page, so no generics needed). */
    items: pages.flatMap((p) => p.items) as TPage["items"],
    /** First page (carries totals / extra fields like check-in counts). */
    first: pages[0],
    total: pages[0]?.total ?? 0,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
  };
}
