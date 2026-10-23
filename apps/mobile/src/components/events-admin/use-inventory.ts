import { useCallback, useMemo } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { trpc } from "~/utils/api";
import { rowIndex } from "./status";

export type Tier = RouterOutputs["event"]["tiersByEvent"][number];
export type Section = RouterOutputs["seatMap"]["forEvent"]["sections"][number];
export type Seat = RouterOutputs["seatMap"]["forEvent"]["seats"][number];

/** Live inventory refresh interval (domain rule: poll ~10 s or on focus). */
export const LIVE_REFRESH_MS = 10_000;

/**
 * Tiers + seat map for one concert, refreshed every ~10 s while mounted and
 * whenever the screen regains focus.
 */
export function useConcertInventory(
  eventId: string,
  options?: { live?: boolean },
) {
  const live = options?.live ?? true;
  const tiersQ = useQuery({
    ...trpc.event.tiersByEvent.queryOptions({ eventId }),
    enabled: !!eventId,
    refetchInterval: live ? LIVE_REFRESH_MS : false,
  });
  const mapQ = useQuery({
    ...trpc.seatMap.forEvent.queryOptions({ eventId }),
    enabled: !!eventId,
    refetchInterval: live ? LIVE_REFRESH_MS : false,
  });

  const { refetch: refetchTiers } = tiersQ;
  const { refetch: refetchMap } = mapQ;
  useFocusEffect(
    useCallback(() => {
      if (!eventId) return;
      void refetchTiers();
      void refetchMap();
    }, [eventId, refetchTiers, refetchMap]),
  );

  const tiers = useMemo(() => tiersQ.data ?? [], [tiersQ.data]);
  const sections = useMemo(() => mapQ.data?.sections ?? [], [mapQ.data]);

  /** Seats grouped by section, rows in natural order (A…Z, AA / 1…10). */
  const seatsBySection = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const s of mapQ.data?.seats ?? []) {
      const list = map.get(s.sectionId) ?? [];
      list.push(s);
      map.set(s.sectionId, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          rowIndex(a.rowLabel) - rowIndex(b.rowLabel) || a.number - b.number,
      );
    }
    return map;
  }, [mapQ.data]);

  // Same heuristic as the web: committed inventory ⇒ orders exist ⇒ the
  // seating mode is locked. The API is the source of truth (BAD_REQUEST).
  const seatingModeLocked =
    tiers.some((t) => t.reserved + t.sold > 0) ||
    (mapQ.data?.seats ?? []).some(
      (s) => s.status === "held" || s.status === "sold",
    );

  return {
    tiersQ,
    mapQ,
    tiers,
    sections,
    seatsBySection,
    seatingModeLocked,
    refetch: () => Promise.all([refetchTiers(), refetchMap()]),
  };
}

export function seatCounts(seats: readonly Seat[]) {
  const c = { available: 0, held: 0, sold: 0, blocked: 0 };
  for (const s of seats) c[s.status]++;
  return c;
}
