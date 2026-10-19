import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { Order } from "@npa/db/schema";
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersSchema,
  submitPaymentProofSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { notImplemented } from "../stub";
import {
  permissionProcedure,
  protectedProcedure,
  publicProcedure,
} from "../trpc";

export const orderRouter = {
  /**
   * Create an order. Reserves seats/tier inventory in one transaction and sets
   * the 30-minute payment window (`expiresAt`). Reserved seats taken mid-
   * checkout throw CONFLICT with the taken seat ids.
   */
  create: protectedProcedure
    .input(createOrderSchema)
    .mutation((): Promise<Order> => notImplemented("order.create")),

  /** Upload receipt + reference → `for_review` (re-submittable once). */
  submitProof: protectedProcedure
    .input(submitPaymentProofSchema)
    .mutation((): Promise<Order> => notImplemented("order.submitProof")),

  /* ---------------------------- customer reads ---------------------------- */
  myOrders: protectedProcedure.query(
    (): Promise<Order[]> => notImplemented("order.myOrders"),
  ),

  byCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query((): Promise<Order | null> => notImplemented("order.byCode")),

  /* ----------------------------- admin orders ----------------------------- */
  /** Search all orders by code / reference / buyer. */
  adminList: permissionProcedure("orders:read")
    .input(listOrdersSchema)
    .query((): Promise<Paginated<Order>> => notImplemented("order.adminList")),

  /** Cancel an order with a note; releases held inventory. */
  cancel: permissionProcedure("orders:review")
    .input(cancelOrderSchema)
    .mutation((): Promise<Order> => notImplemented("order.cancel")),

  /**
   * Release expired, unpaid orders (reserved seats/tier back to available).
   * Called by the Vercel cron every 5 min via a server-side caller after the
   * route verifies `CRON_SECRET`.
   */
  releaseExpired: publicProcedure.mutation(
    (): Promise<{ released: number }> => notImplemented("order.releaseExpired"),
  ),
} satisfies TRPCRouterRecord;
