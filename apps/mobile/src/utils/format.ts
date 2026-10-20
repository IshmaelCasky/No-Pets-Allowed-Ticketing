/** UI formatting helpers. Money is stored as integer centavos; format only here. */

const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

/** Format integer centavos as `₱1,234.00`. */
export function formatCentavos(centavos: number): string {
  return PESO.format(centavos / 100);
}

const MANILA_DATETIME = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

const MANILA_DATE = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
});

/** Format a date in Asia/Manila (date + time). */
export function formatManila(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return MANILA_DATETIME.format(d);
}

/** Format a date in Asia/Manila (date only). */
export function formatManilaDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return MANILA_DATE.format(d);
}

/** Remaining time until `target` as `MM:SS` (clamped at 00:00). */
export function countdownMMSS(
  target: Date | string | null | undefined,
): string {
  if (!target) return "00:00";
  const t = typeof target === "string" ? new Date(target) : target;
  const ms = Math.max(0, t.getTime() - Date.now());
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Human label for an order status. */
export function orderStatusLabel(status: string): string {
  return status
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
