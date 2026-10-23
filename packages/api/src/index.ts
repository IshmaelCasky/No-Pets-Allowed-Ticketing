import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { createCallerFactory, createTRPCContext } from "./trpc";

/**
 * Inference helpers for input types
 * @example
 * type CreateEventInput = RouterInputs['event']['create']
 */
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 * @example
 * type MyTicketsOutput = RouterOutputs['ticket']['myTickets']
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * Server-side caller factory. Used by the Vercel cron route (after verifying
 * CRON_SECRET) and by tests to invoke procedures without HTTP.
 */
const createCaller = createCallerFactory(appRouter);

export { appRouter, createCaller, createCallerFactory, createTRPCContext };
export type { AppRouter, RouterInputs, RouterOutputs };

export { audit } from "./audit";
export type { AuditContext, AuditEntry } from "./audit";
export type { Paginated } from "./stub";
export { handleHitpayWebhook } from "./webhook";
