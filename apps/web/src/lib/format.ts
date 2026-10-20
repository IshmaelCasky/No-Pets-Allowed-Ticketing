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

/** For `<input type="datetime-local">` default values (local wall time). */
export function toDatetimeLocal(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
