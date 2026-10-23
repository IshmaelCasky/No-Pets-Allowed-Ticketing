import type { EventStatus } from "@npa/validators";

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
