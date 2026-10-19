import type { TRPCRouterRecord } from "@trpc/server";

import type { Order } from "@npa/db/schema";
import {
  approveOrderSchema,
  rejectOrderSchema,
  reviewQueueSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { notImplemented } from "../stub";
import { permissionProcedure } from "../trpc";

/** A review-queue row carries the order plus a duplicate-reference flag. */
export interface ReviewQueueItem {
  order: Order;
  isDuplicateReference: boolean;
}

export const reviewRouter = {
  /** Payment review queue, oldest first. */
  queue: permissionProcedure("orders:review")
    .input(reviewQueueSchema)
    .query(
      (): Promise<Paginated<ReviewQueueItem>> => notImplemented("review.queue"),
    ),

  /**
   * Approve: conditional update WHERE status = 'for_review'. Seats reserved →
   * sold, one ticket per seat generated, approval email sent. Zero rows
   * updated → CONFLICT ("already reviewed").
   */
  approve: permissionProcedure("orders:review")
    .input(approveOrderSchema)
    .mutation((): Promise<Order> => notImplemented("review.approve")),

  /** Reject (reason required); customer may re-upload once before expiry. */
  reject: permissionProcedure("orders:review")
    .input(rejectOrderSchema)
    .mutation((): Promise<Order> => notImplemented("review.reject")),
} satisfies TRPCRouterRecord;
