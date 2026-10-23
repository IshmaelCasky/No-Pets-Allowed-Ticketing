import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import type { Order, Ticket, User } from "@npa/db/schema";
import { and, count, desc, eq, or, sql } from "@npa/db";
import { order, role, ticket, user } from "@npa/db/schema";
import {
  assignUserRoleSchema,
  banUserSchema,
  byIdSchema,
  createStaffSchema,
  listUsersSchema,
  resetUserPasswordSchema,
  unbanUserSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { audit } from "../audit";
import { permissionProcedure } from "../trpc";

/** better-auth plugin `role` string for an NPA role name. */
function authRoleFor(roleName: string | undefined): "admin" | "user" {
  return roleName && roleName !== "Customer" ? "admin" : "user";
}

export const userRouter = {
  list: permissionProcedure("users:read")
    .input(listUsersSchema)
    .query(async ({ ctx, input }): Promise<Paginated<User>> => {
      const filters = [];
      if (input.roleId) filters.push(eq(user.roleId, input.roleId));
      if (input.banned !== undefined)
        filters.push(eq(user.banned, input.banned));
      if (input.search) {
        const q = `%${input.search}%`;
        filters.push(
          or(sql`${user.name} ilike ${q}`, sql`${user.email} ilike ${q}`),
        );
      }
      const where = filters.length ? and(...filters) : undefined;

      const offset = (input.page - 1) * input.pageSize;
      const [items, [totalRow]] = await Promise.all([
        ctx.db
          .select()
          .from(user)
          .where(where)
          .orderBy(desc(user.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ value: count() }).from(user).where(where),
      ]);
      return {
        items,
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** A user with their orders + tickets (admin detail view). */
  byId: permissionProcedure("users:read")
    .input(byIdSchema)
    .query(
      async ({
        ctx,
        input,
      }): Promise<(User & { orders: Order[]; tickets: Ticket[] }) | null> => {
        const row = await ctx.db.query.user.findFirst({
          where: eq(user.id, input.id),
        });
        if (!row) return null;
        const [orders, tickets] = await Promise.all([
          ctx.db
            .select()
            .from(order)
            .where(eq(order.userId, input.id))
            .orderBy(desc(order.createdAt)),
          ctx.db
            .select({
              id: ticket.id,
              orderId: ticket.orderId,
              eventId: ticket.eventId,
              tierId: ticket.tierId,
              holderName: ticket.holderName,
              token: ticket.token,
              status: ticket.status,
              usedAt: ticket.usedAt,
              usedById: ticket.usedById,
              createdAt: ticket.createdAt,
            })
            .from(ticket)
            .innerJoin(order, eq(ticket.orderId, order.id))
            .where(eq(order.userId, input.id)),
        ]);
        return { ...row, orders, tickets };
      },
    ),

  createStaff: permissionProcedure("users:write")
    .input(createStaffSchema)
    .mutation(async ({ ctx, input }): Promise<User> => {
      const targetRole = await ctx.db.query.role.findFirst({
        where: eq(role.id, input.roleId),
        columns: { name: true },
      });
      if (!targetRole) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown role" });
      }

      const created = await ctx.authApi.createUser({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
          role: authRoleFor(targetRole.name),
        },
        headers: ctx.headers,
      });
      const newId = created.user.id;

      // Set our extension columns (roleId, phone) directly.
      const [row] = await ctx.db
        .update(user)
        .set({ roleId: input.roleId, phone: input.phone ?? null })
        .where(eq(user.id, newId))
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await audit(ctx, {
        action: "user.create",
        entityType: "user",
        entityId: row.id,
        after: { id: row.id, email: row.email, roleId: row.roleId },
      });
      return row;
    }),

  /** Assign a role. Users can never edit their own role (enforced in body). */
  assignRole: permissionProcedure("users:write")
    .input(assignUserRoleSchema)
    .mutation(async ({ ctx, input }): Promise<User> => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot change your own role",
        });
      }
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.user.findFirst({
          where: eq(user.id, input.userId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        const targetRole = await tx.query.role.findFirst({
          where: eq(role.id, input.roleId),
          columns: { name: true },
        });
        if (!targetRole) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown role" });
        }
        // The last Super Admin can't be demoted.
        if (before.roleId && before.roleId !== input.roleId) {
          const currentRole = await tx.query.role.findFirst({
            where: eq(role.id, before.roleId),
            columns: { name: true },
          });
          if (
            currentRole?.name === "Super Admin" &&
            targetRole.name !== "Super Admin"
          ) {
            const [c] = await tx
              .select({ n: count() })
              .from(user)
              .where(eq(user.roleId, before.roleId));
            if ((c?.n ?? 0) <= 1) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Cannot demote the last Super Admin",
              });
            }
          }
        }
        const [row] = await tx
          .update(user)
          .set({
            roleId: input.roleId,
            // Keep better-auth's admin gate in sync with the NPA role.
            role: authRoleFor(targetRole.name),
          })
          .where(eq(user.id, input.userId))
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "user.assign_role",
            entityType: "user",
            entityId: row.id,
            before: { roleId: before.roleId },
            after: { roleId: row.roleId },
          },
          tx,
        );
        return row;
      });
    }),

  ban: permissionProcedure("users:ban")
    .input(banUserSchema)
    .mutation(async ({ ctx, input }): Promise<User> => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot ban yourself",
        });
      }
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.user.findFirst({
          where: eq(user.id, input.userId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        const [row] = await tx
          .update(user)
          .set({ banned: true, banReason: input.reason })
          .where(eq(user.id, input.userId))
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "user.ban",
            entityType: "user",
            entityId: row.id,
            before: { banned: before.banned },
            after: { banned: row.banned, banReason: row.banReason },
          },
          tx,
        );
        return row;
      });
    }),

  unban: permissionProcedure("users:ban")
    .input(unbanUserSchema)
    .mutation(async ({ ctx, input }): Promise<User> => {
      return ctx.db.transaction(async (tx) => {
        const before = await tx.query.user.findFirst({
          where: eq(user.id, input.userId),
        });
        if (!before) throw new TRPCError({ code: "NOT_FOUND" });
        const [row] = await tx
          .update(user)
          .set({ banned: false, banReason: null })
          .where(eq(user.id, input.userId))
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await audit(
          ctx,
          {
            action: "user.unban",
            entityType: "user",
            entityId: row.id,
            before: { banned: before.banned },
            after: { banned: row.banned },
          },
          tx,
        );
        return row;
      });
    }),

  resetPassword: permissionProcedure("users:write")
    .input(resetUserPasswordSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: true }> => {
      await ctx.authApi.setUserPassword({
        body: { newPassword: input.password, userId: input.userId },
        headers: ctx.headers,
      });
      await audit(ctx, {
        action: "user.reset_password",
        entityType: "user",
        entityId: input.userId,
      });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
