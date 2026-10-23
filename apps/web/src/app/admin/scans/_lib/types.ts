import type { RouterOutputs } from "@npa/api";

export type ScanEventOption = RouterOutputs["scan"]["eventOptions"][number];
export type CheckinRow = RouterOutputs["scan"]["checkins"]["items"][number];
export type ScanLogRow = RouterOutputs["scan"]["logs"]["items"][number];

/** How long after a concert starts it still counts as "current" (doors → end). */
const CURRENT_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Default concert for the Check-ins tab: the nearest upcoming one (including
 * one that started within the last 12 h, i.e. happening tonight), otherwise
 * the most recent past concert. `events` is sorted newest `startsAt` first.
 */
export function pickDefaultEventId(
  events: ScanEventOption[],
  now: number = Date.now(),
): string | undefined {
  const dated = events.flatMap((e) =>
    e.startsAt ? [{ e, at: new Date(e.startsAt).getTime() }] : [],
  );
  const upcoming = dated
    .filter(
      ({ e, at }) => e.status !== "cancelled" && at >= now - CURRENT_WINDOW_MS,
    )
    .sort((a, b) => a.at - b.at);
  if (upcoming[0]) return upcoming[0].e.id;
  const past = dated.filter(({ at }) => at < now).sort((a, b) => b.at - a.at);
  return (past[0]?.e ?? events[0])?.id;
}

/** `YYYY-MM-DD` from a date input → start/end of that day in Asia/Manila. */
export function manilaDayStart(day: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  return new Date(`${day}T00:00:00.000+08:00`);
}

export function manilaDayEnd(day: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  return new Date(`${day}T23:59:59.999+08:00`);
}
