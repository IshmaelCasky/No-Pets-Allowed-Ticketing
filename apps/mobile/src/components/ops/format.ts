/** Extra Asia/Manila formatters for the ops modules (see ~/utils/format). */

const STAMP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
});

/** `YYYY-MM-DD` in Asia/Manila, for export filenames. */
export function manilaStamp(date = new Date()): string {
  return STAMP.format(date);
}

/** Time of day in Asia/Manila (e.g. `7:42 PM`) for gate lists. */
export function manilaTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return TIME.format(typeof date === "string" ? new Date(date) : date);
}
