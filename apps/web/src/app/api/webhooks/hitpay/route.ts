import type { NextRequest } from "next/server";

import { handleHitpayWebhook } from "@npa/api";

/**
 * HitPay payment webhook.
 *
 * HitPay POSTs a form-encoded body (including an HMAC) when a payment's status
 * changes. We hand the raw fields to `handleHitpayWebhook`, which verifies the
 * HMAC and reconciles the order — so no auth/session is required here.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  const result = await handleHitpayWebhook(fields);
  return new Response(null, { status: result.status });
}

export function GET() {
  return new Response(null, { status: 405 });
}
