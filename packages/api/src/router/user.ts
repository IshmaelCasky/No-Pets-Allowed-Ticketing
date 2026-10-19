import type { TRPCRouterRecord } from "@trpc/server";

import type { Order, Ticket, User } from "@npa/db/schema";
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
import { notImplemented } from "../stub";
import { permissionProcedure } from "../trpc";

export const userRouter = {
  list: permissionProcedure("users:read")
    .input(listUsersSchema)
    .query((): Promise<Paginated<User>> => notImplemented("user.list")),

  /** A user with their orders + tickets (admin detail view). */
  byId: permissionProcedure("users:read")
    .input(byIdSchema)
    .query(
      (): Promise<(User & { orders: Order[]; tickets: Ticket[] }) | null> =>
        notImplemented("user.byId"),
    ),

  createStaff: permissionProcedure("users:write")
    .input(createStaffSchema)
    .mutation((): Promise<User> => notImplemented("user.createStaff")),

  /** Assign a role. Users can never edit their own role (enforced in body). */
  assignRole: permissionProcedure("users:write")
    .input(assignUserRoleSchema)
    .mutation((): Promise<User> => notImplemented("user.assignRole")),

  ban: permissionProcedure("users:ban")
    .input(banUserSchema)
    .mutation((): Promise<User> => notImplemented("user.ban")),

  unban: permissionProcedure("users:ban")
    .input(unbanUserSchema)
    .mutation((): Promise<User> => notImplemented("user.unban")),

  resetPassword: permissionProcedure("users:write")
    .input(resetUserPasswordSchema)
    .mutation(
      (): Promise<{ success: true }> => notImplemented("user.resetPassword"),
    ),
} satisfies TRPCRouterRecord;
