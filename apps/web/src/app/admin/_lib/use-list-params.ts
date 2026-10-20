"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Read + write list state (page, search, filters) through the URL query string
 * so admin tables are shareable and survive refresh. Updating any filter resets
 * the page to 1.
 */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = useCallback((key: string) => params.get(key) ?? "", [params]);

  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const setParams = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      let touchedFilter = false;
      for (const [key, value] of Object.entries(patch)) {
        if (key !== "page") touchedFilter = true;
        if (value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      if (touchedFilter && patch.page === undefined) next.set("page", "1");
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  const setPage = useCallback(
    (p: number) => setParams({ page: p }),
    [setParams],
  );

  return { get, page, setParams, setPage };
}
