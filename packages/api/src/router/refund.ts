import type { TRPCRouterRecord } from "@trpc/server";

import type { RefundRequest } from "@npa/db/schema";
import {
  approveRefundSchema,
  listRefundsSchema,
  markRefundPaidSchema,
  rejectRefundSchema,
  requestRefundSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { notImplemented } from "../stub";
import { permissionProcedure, protectedProcedure } from "../trpc";

export const refundRouter = {
  /** Customer requests a refund (allowed until refundCutoffDays before start). */
  request: protectedProcedure
    .input(requestRefundSchema)
    .mutation((): Promise<RefundRequest> => notImplemented("refund.request")),

  myRefunds: protectedProcedure.query(
    (): Promise<RefundRequest[]> => notImplemented("refund.myRefunds"),
  ),

  /* ------------------------------ staff queue ----------------------------- */
  queue: permissionProcedure("refunds:review")
    .input(listRefundsSchema)
    .query(
      (): Promise<Paginated<RefundRequest>> => notImplemented("refund.queue"),
    ),

  /** Approve → tickets void immediately, seats/tier released, order stays approved until paid. */
  approve: permissionProcedure("refunds:review")
    .input(approveRefundSchema)
    .mutation((): Promise<RefundRequest> => notImplemented("refund.approve")),

  /** Reject (reason required); tickets untouched. */
  reject: permissionProcedure("refunds:review")
    .input(rejectRefundSchema)
    .mutation((): Promise<RefundRequest> => notImplemented("refund.reject")),

  /** Mark paid with transfer receipt + reference → order `refunded`. */
  markPaid: permissionProcedure("refunds:review")
    .input(markRefundPaidSchema)
    .mutation((): Promise<RefundRequest> => notImplemented("refund.markPaid")),
} satisfies TRPCRouterRecord;
