import { useCallback, useMemo } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { trpc } from "~/utils/api";

export type Tier = RouterOutputs["event"]["tiersByEvent"][number];

/** Live inventory refresh interval (domain rule: poll ~10 s or on focus). */
export const LIVE_REFRESH_MS = 10_000;

/**
 * Ticket tiers for one concert, refreshed every ~10 s while mounted and
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

  const { refetch: refetchTiers } = tiersQ;
  useFocusEffect(
    useCallback(() => {
      if (!eventId) return;
      void refetchTiers();
    }, [eventId, refetchTiers]),
  );

  const tiers = useMemo(() => tiersQ.data ?? [], [tiersQ.data]);

  return {
    tiersQ,
    tiers,
    refetch: () => Promise.all([refetchTiers()]),
  };
}
