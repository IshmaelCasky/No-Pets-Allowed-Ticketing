import type { EventStatus, SeatingMode, SeatStatus } from "@npa/validators";

import type { Tone } from "~/components/admin";

export const EVENT_STATUS_OPTIONS: readonly {
  value: EventStatus;
  label: string;
}[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "ended", label: "Ended" },
  { value: "cancelled", label: "Cancelled" },
];

export const EVENT_STATUS_TONE: Record<EventStatus, Tone> = {
  draft: "gray",
  published: "green",
  ended: "blue",
  cancelled: "red",
};

export function eventStatusLabel(status: EventStatus): string {
  return EVENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function seatingModeLabel(mode: SeatingMode): string {
  return mode === "ga" ? "General admission" : "Reserved seating";
}

/** Live seat-map colours (same meaning as the web grid builder). */
export const SEAT_COLOR: Record<SeatStatus, string> = {
  available: "#10b981",
  held: "#f59e0b",
  sold: "#f43f5e",
  blocked: "#71717a",
};

export const SEAT_STATUS_LABEL: Record<SeatStatus, string> = {
  available: "Available",
  held: "Held",
  sold: "Sold",
  blocked: "Blocked",
};

/** Ring drawn around seats picked for a bulk block / unblock. */
export const SELECTED_STROKE = "#38bdf8";

export const DEFAULT_SECTION_COLOR = "#6366f1";

/**
 * Row label → zero-based row index, so rows sort A, B … Z, AA and 1, 2 … 10
 * (the API returns seats ordered by the row label as text).
 */
export function rowIndex(label: string): number {
  if (/^\d+$/.test(label)) return Number(label) - 1;
  let n = 0;
  for (const ch of label.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Row label for a zero-based index (mirrors the API's `rowLabelFor`). */
export function rowLabelFor(index: number, style: "alpha" | "numeric"): string {
  if (style === "numeric") return String(index + 1);
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}
