import { eq } from "@npa/db";
import { db } from "@npa/db/client";
import { order } from "@npa/db/schema";

import { audit } from "./audit";
import { OrderApprovedEmail, sendEmail } from "./emails";
import { fulfillPaidOrderTx } from "./fulfill";
import { verifyWebhookSignature } from "./hitpay";

/**
 * Handle a HitPay webhook (POST form fields). Verifies the HMAC signature, and
 * on a `completed` payment fulfils the matching order (→ approved + tickets).
 * Idempotent and safe to receive more than once. Returns an HTTP status for the
 * route handler to echo back.
 */
export async function handleHitpayWebhook(
  fields: Record<string, string>,
): Promise<{ status: number }> {
  if (!verifyWebhookSignature(fields)) {
    return { status: 401 };
  }

  // Only completed payments advance an order; ack everything else so HitPay
  // stops retrying.
  if (fields.status !== "completed") return { status: 200 };

  const reference = fields.reference_number;
  const paymentId = fields.payment_request_id;
  const ord = await db.query.order.findFirst({
    where: reference
      ? eq(order.code, reference)
      : eq(order.hitpayPaymentId, paymentId ?? ""),
  });
  if (ord?.status !== "pending_payment") return { status: 200 };

  const result = await db.transaction(async (tx) => {
    const r = await fulfillPaidOrderTx(tx, ord.id, fields.status);
    await audit(
      { db, session: null, ip: null, userAgent: null },
      {
        action: "order.paid",
        entityType: "order",
        entityId: ord.id,
        after: r.order,
      },
      tx,
    );
    return r;
  });

  if (!result.alreadyFulfilled && result.email) {
    await sendEmail({
      to: result.email,
      subject: `Your order ${result.order.code} is confirmed`,
      react: OrderApprovedEmail({
        orderCode: result.order.code,
        eventTitle: result.eventTitle,
      }),
    });
  }
  return { status: 200 };
}
