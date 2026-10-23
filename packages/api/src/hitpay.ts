import crypto from "node:crypto";

/**
 * HitPay payment gateway client (sandbox by default). Reads credentials from
 * env at call time: HITPAY_API_KEY, HITPAY_SALT, HITPAY_API_URL.
 *
 * Amounts in our domain are integer centavos; HitPay wants a decimal string in
 * the major unit (e.g. 1234.00). Currency is PHP.
 */
function cfg() {
  return {
    apiKey: process.env.HITPAY_API_KEY ?? "",
    salt: process.env.HITPAY_SALT ?? "",
    apiUrl: process.env.HITPAY_API_URL ?? "https://api.sandbox.hit-pay.com/v1/",
  };
}

/** True when real (non-placeholder) credentials are present. */
export function hitpayConfigured(): boolean {
  const { apiKey, salt } = cfg();
  return apiKey.length > 0 && salt.length > 0 && !apiKey.startsWith("dev");
}

export interface CreatePaymentRequestArgs {
  /** Integer centavos. */
  amount: number;
  referenceNumber: string;
  redirectUrl: string;
  webhook: string;
  name?: string;
  email?: string;
  currency?: string;
}

export interface HitpayPayment {
  id: string;
  url: string;
  status: string;
}

function headers(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-BUSINESS-API-KEY": apiKey,
    "X-Requested-With": "XMLHttpRequest",
  };
}

export async function createPaymentRequest(
  args: CreatePaymentRequestArgs,
): Promise<HitpayPayment> {
  const { apiKey, apiUrl } = cfg();
  if (!apiKey) throw new Error("HITPAY_API_KEY is not configured");

  const body = new URLSearchParams();
  body.set("amount", (args.amount / 100).toFixed(2));
  body.set("currency", args.currency ?? "PHP");
  body.set("reference_number", args.referenceNumber);
  body.set("redirect_url", args.redirectUrl);
  body.set("webhook", args.webhook);
  if (args.name) body.set("name", args.name);
  if (args.email) body.set("email", args.email);

  const res = await fetch(`${apiUrl}payment-requests`, {
    method: "POST",
    headers: headers(apiKey),
    // Serialize to a string so the body type is valid under both DOM and
    // React Native fetch typings (RN's BodyInit excludes URLSearchParams).
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`HitPay create failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    id: string;
    url: string;
    status: string;
  };
  return { id: json.id, url: json.url, status: json.status };
}

export async function getPaymentRequest(
  id: string,
): Promise<{ id: string; status: string }> {
  const { apiKey, apiUrl } = cfg();
  if (!apiKey) throw new Error("HITPAY_API_KEY is not configured");
  const res = await fetch(`${apiUrl}payment-requests/${id}`, {
    headers: headers(apiKey),
  });
  if (!res.ok) {
    throw new Error(`HitPay fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as { id: string; status: string };
  return { id: json.id, status: json.status };
}

/**
 * Verify a HitPay webhook. HitPay signs the POST form fields with HMAC-SHA256:
 * concatenate every field except `hmac` as `key+value`, sorted alphabetically
 * by key, then HMAC with the salt; compare (constant-time) to the `hmac` field.
 */
export function verifyWebhookSignature(
  fields: Record<string, string>,
): boolean {
  const { salt } = cfg();
  if (!salt) return false;
  const { hmac, ...rest } = fields;
  if (!hmac) return false;
  const payload = Object.keys(rest)
    .sort()
    .map((k) => `${k}${rest[k]}`)
    .join("");
  const computed = crypto
    .createHmac("sha256", salt)
    .update(payload)
    .digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
