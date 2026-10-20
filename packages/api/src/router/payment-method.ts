import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import type { PaymentMethod } from "@npa/db/schema";
import { asc, eq } from "@npa/db";
import { paymentMethod } from "@npa/db/schema";
import {
  byIdSchema,
  createPaymentMethodSchema,
  reorderPaymentMethodsSchema,
  updatePaymentMethodSchema,
} from "@npa/validators";

import { audit } from "../audit";
import { permissionProcedure, publicProcedure } from "../trpc";

export const paymentMethodRouter = {
  listActive: publicProcedure.query(
    async ({ ctx }): Promise<PaymentMethod[]> => {
      return ctx.db
        .select()
        .from(paymentMethod)
        .where(eq(paymentMethod.isActive, true))
        .orderBy(asc(paymentMethod.sortOrder));
    },
  ),

  listAll: permissionProcedure("payment_methods:write").query(
    async ({ ctx }): Promise<PaymentMethod[]> => {
      return ctx.db
        .select()
        .from(paymentMethod)
        .orderBy(asc(paymentMethod.sortOrder));
    },
  ),

  create: permissionProcedure("payment_methods:write")
    .input(createPaymentMethodSchema)
    .mutation(async ({ ctx, input }): Promise<PaymentMethod> => {
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx.insert(paymentMethod).values(input).returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "payment_method.create",
            entityType: "payment_method",
            entityId: row.id,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  update: permissionProcedure("payment_methods:write")
    .input(updatePaymentMethodSchema)
    .mutation(async ({ ctx, input }): Promise<PaymentMethod> => {
      const { id, ...patch } = input;
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.paymentMethod.findFirst({
          where: eq(paymentMethod.id, id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        const [row] = await tx
          .update(paymentMethod)
          .set(patch)
          .where(eq(paymentMethod.id, id))
          .returning();
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        await audit(
          ctx,
          {
            action: "payment_method.update",
            entityType: "payment_method",
            entityId: id,
            before,
            after: row,
          },
          tx,
        );
        return row;
      });
    }),

  delete: permissionProcedure("payment_methods:write")
    .input(byIdSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.paymentMethod.findFirst({
          where: eq(paymentMethod.id, input.id),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        await tx.delete(paymentMethod).where(eq(paymentMethod.id, input.id));
        await audit(
          ctx,
          {
            action: "payment_method.delete",
            entityType: "payment_method",
            entityId: input.id,
            before,
          },
          tx,
        );
        return { id: input.id };
      });
    }),

  reorder: permissionProcedure("payment_methods:write")
    .input(reorderPaymentMethodsSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: true }> => {
      await ctx.db.transaction(async (tx) => {
        for (let i = 0; i < input.orderedIds.length; i++) {
          const id = input.orderedIds[i];
          if (!id) continue;
          await tx
            .update(paymentMethod)
            .set({ sortOrder: i })
            .where(eq(paymentMethod.id, id));
        }
        await audit(
          ctx,
          {
            action: "payment_method.reorder",
            entityType: "payment_method",
            after: { orderedIds: input.orderedIds },
          },
          tx,
        );
      });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
