import { z } from "zod/v4";

import { idSchema, paginationSchema } from "./common";
import { refundStatusSchema } from "./enums";

/** Customer requests a refund: reason + payout details. */
export const requestRefundSchema = z.object({
  orderId: idSchema,
  reason: z.string().trim().min(1, "A reason is required").max(1000),
  payoutMethod: z.string().trim().min(1).max(120),
  payoutAccountName: z.string().trim().min(1).max(200),
  payoutAccountNumber: z.string().trim().min(1).max(120),
});
export type RequestRefundInput = z.infer<typeof requestRefundSchema>;

export const approveRefundSchema = z.object({ refundRequestId: idSchema });

export const rejectRefundSchema = z.object({
  refundRequestId: idSchema,
  reason: z.string().trim().min(1, "A rejection reason is required").max(1000),
});
export type RejectRefundInput = z.infer<typeof rejectRefundSchema>;

/** Staff mark the payout as paid with transfer receipt + reference. */
export const markRefundPaidSchema = z.object({
  refundRequestId: idSchema,
  payoutReference: z.string().trim().min(1).max(120),
  payoutProofKey: z.string().trim().min(1).max(512),
});
export type MarkRefundPaidInput = z.infer<typeof markRefundPaidSchema>;

export const listRefundsSchema = paginationSchema.extend({
  status: refundStatusSchema.optional(),
  eventId: idSchema.optional(),
});
