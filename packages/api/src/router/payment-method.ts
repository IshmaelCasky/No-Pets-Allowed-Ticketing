import type { TRPCRouterRecord } from "@trpc/server";

import type { PaymentMethod } from "@npa/db/schema";
import {
  byIdSchema,
  createPaymentMethodSchema,
  reorderPaymentMethodsSchema,
  updatePaymentMethodSchema,
} from "@npa/validators";

import { notImplemented } from "../stub";
import { permissionProcedure, publicProcedure } from "../trpc";

export const paymentMethodRouter = {
  /** Active methods shown to buyers at checkout (QR, account, instructions). */
  listActive: publicProcedure.query(
    (): Promise<PaymentMethod[]> => notImplemented("paymentMethod.listActive"),
  ),

  /** All methods (admin management). */
  listAll: permissionProcedure("payment_methods:write").query(
    (): Promise<PaymentMethod[]> => notImplemented("paymentMethod.listAll"),
  ),

  create: permissionProcedure("payment_methods:write")
    .input(createPaymentMethodSchema)
    .mutation(
      (): Promise<PaymentMethod> => notImplemented("paymentMethod.create"),
    ),

  update: permissionProcedure("payment_methods:write")
    .input(updatePaymentMethodSchema)
    .mutation(
      (): Promise<PaymentMethod> => notImplemented("paymentMethod.update"),
    ),

  delete: permissionProcedure("payment_methods:write")
    .input(byIdSchema)
    .mutation(
      (): Promise<{ id: string }> => notImplemented("paymentMethod.delete"),
    ),

  reorder: permissionProcedure("payment_methods:write")
    .input(reorderPaymentMethodsSchema)
    .mutation(
      (): Promise<{ success: true }> => notImplemented("paymentMethod.reorder"),
    ),
} satisfies TRPCRouterRecord;
