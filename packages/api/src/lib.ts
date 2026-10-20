import { randomBytes, randomInt } from "node:crypto";
import { UTApi } from "uploadthing/server";

/** QR ticket token: random 128-bit, base64url, unique. Encodes only the token. */
export function generateTicketToken(): string {
  return randomBytes(16).toString("base64url");
}

const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** `NPA-XXXXX` order code (uniqueness enforced by the DB unique index). */
export function generateOrderCode(): string {
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)];
  }
  return `NPA-${suffix}`;
}

/** Row label for a 0-based row index given the section's label style. */
export function rowLabelFor(index: number, style: "alpha" | "numeric"): string {
  if (style === "numeric") return String(index + 1);
  // alpha: A..Z, then AA, AB, ...
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/** Seat label e.g. `VIP-B12` from section name + row label + seat number. */
export function seatLabel(
  sectionName: string,
  rowLabel: string,
  number: number,
): string {
  return `${sectionName}-${rowLabel}${number}`;
}

const DEFAULT_PAGE_SIZE = 20;

export function paginationArgs(input: { page?: number; pageSize?: number }): {
  limit: number;
  offset: number;
  page: number;
  pageSize: number;
} {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  return { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize };
}

/* -------------------------------------------------------------------------- */
/*  UploadThing signed URLs                                                   */
/* -------------------------------------------------------------------------- */

function utApi(): UTApi | null {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token || token.startsWith("dev")) return null;
  try {
    return new UTApi();
  } catch {
    return null;
  }
}

/**
 * Resolve a private proof image key to a short-lived signed URL. Degrades to
 * `null` when UploadThing isn't configured (dev placeholder / missing token),
 * never throws. Caller is responsible for the ownership guard.
 */
export async function signedProofUrl(
  key: string | null | undefined,
): Promise<string | null> {
  if (!key) return null;
  const api = utApi();
  if (!api) return null;
  try {
    const res = await api.getSignedURL(key, { expiresIn: 60 * 15 });
    return res.ufsUrl;
  } catch {
    return null;
  }
}

/** CSV cell escaping (RFC 4180-ish). */
export function csvCell(value: string | number | null | undefined): string {
  const s =
    value == null ? "" : typeof value === "number" ? String(value) : value;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
