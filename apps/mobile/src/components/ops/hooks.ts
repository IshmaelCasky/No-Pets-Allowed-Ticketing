/** Small hooks shared by the Dashboard, Transactions and Gate modules. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { SelectOption } from "./select";
import { trpc } from "~/utils/api";
import { formatManilaDate } from "~/utils/format";
import { usePermissions } from "~/utils/use-permissions";

/** `value`, but only after it stopped changing for `ms` (search boxes). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** True while this screen is the focused one in its navigator. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

/** Call `fn` every `ms` while the screen is focused (live counters). */
export function useFocusInterval(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      const t = setInterval(() => ref.current(), ms);
      return () => clearInterval(t);
    }, [ms, enabled]),
  );
}

/**
 * Concerts for the scanner / Scans pickers. Uses `scan.eventOptions` (every
 * non-draft concert) because scanners lack `events:read`.
 */
export function useScanConcerts() {
  const query = useQuery(trpc.scan.eventOptions.queryOptions());
  const options = useMemo<SelectOption[]>(
    () =>
      (query.data ?? []).map((e) => ({
        value: e.id,
        label: e.title,
        hint: [
          e.startsAt ? formatManilaDate(e.startsAt) : null,
          e.status !== "published" ? e.status : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [query.data],
  );
  return { ...query, options };
}

/**
 * Concert id → title for Transactions rows, using whatever the role can read:
 * the published list (public), plus every non-draft concert for scanners and
 * the admin list for `events:read`.
 */
export function useConcertTitles() {
  const { has } = usePermissions();
  const publicQ = useQuery(trpc.event.publicList.queryOptions());
  const scanQ = useQuery({
    ...trpc.scan.eventOptions.queryOptions(),
    enabled: has("tickets:scan"),
  });
  const adminQ = useQuery({
    ...trpc.event.list.queryOptions({ page: 1, pageSize: 100 }),
    enabled: has("events:read"),
  });
  return useMemo(() => {
    const titles = new Map<string, string>();
    for (const e of publicQ.data ?? []) titles.set(e.id, e.title);
    for (const e of scanQ.data ?? []) titles.set(e.id, e.title);
    for (const e of adminQ.data?.items ?? []) titles.set(e.id, e.title);
    const options: SelectOption[] = [...titles.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { titles, options };
  }, [publicQ.data, scanQ.data, adminQ.data]);
}
