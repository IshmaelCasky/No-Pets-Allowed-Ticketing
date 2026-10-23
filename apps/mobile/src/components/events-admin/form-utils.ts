/**
 * Small helpers for the Concerts admin forms. The mobile app doesn't ship
 * react-hook-form, so forms keep controlled string state and validate with the
 * shared Zod schema (`schema.safeParse`) on submit, then map issues to fields.
 */

/** Manila is UTC+8 all year (no DST). */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Format a stored UTC date as `YYYY-MM-DD HH:mm` in Asia/Manila for editing. */
export function toManilaInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + MANILA_OFFSET_MS)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

const MANILA_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/;

export type ParsedDate =
  | { ok: true; value: Date | undefined }
  | { ok: false; message: string };

/**
 * Parse `YYYY-MM-DD HH:mm` (24-hour) interpreted as Asia/Manila time.
 * Blank → `undefined` (field not provided).
 */
export function parseManilaInput(raw: string): ParsedDate {
  const s = raw.trim();
  if (s === "") return { ok: true, value: undefined };
  const m = MANILA_INPUT_RE.exec(s);
  if (!m) return { ok: false, message: "Use YYYY-MM-DD HH:mm (24-hour)" };
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - MANILA_OFFSET_MS;
  const value = new Date(utc);
  // Round-trip to reject things like 2026-02-31 or 25:00.
  if (toManilaInput(value) !== `${m[1]}-${m[2]}-${m[3]} ${pad(h)}:${m[5]}`) {
    return { ok: false, message: "That date/time doesn't exist" };
  }
  return { ok: true, value };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Pesos typed in the UI (e.g. `1500` or `1,500.50`) → integer centavos. NaN if invalid. */
export function pesosToCentavos(raw: string): number {
  const s = raw.replace(/[₱,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 100);
}

/** Integer centavos → editable pesos string (`1500` / `1500.50`). */
export function centavosToPesos(centavos: number): string {
  return centavos % 100 === 0
    ? String(centavos / 100)
    : (centavos / 100).toFixed(2);
}

/** Whole number from a text field; NaN if not a plain integer. */
export function parseIntField(raw: string): number {
  const s = raw.trim();
  return /^\d+$/.test(s) ? Number(s) : Number.NaN;
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Map Zod issues to `{ field: firstMessage }` (top-level path segment). */
export function issuesToErrors<K extends string>(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): FieldErrors<K> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && out[key] === undefined) {
      out[key] = issue.message;
    }
  }
  return out as FieldErrors<K>;
}

/** `My Show 2026!` → `my-show-2026` (matches the shared slug rule). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

/** Trimmed string, or `undefined` when blank. */
export function blankToUndefined(value: string): string | undefined {
  const t = value.trim();
  return t === "" ? undefined : t;
}
