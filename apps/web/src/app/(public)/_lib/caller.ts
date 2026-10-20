import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@npa/api";

import { auth } from "~/auth/server";

/**
 * In-process tRPC caller for RSC data fetching on the customer surfaces.
 * Carries the request's auth context so protected reads (my orders/tickets)
 * work when the user is signed in.
 */
export const getCaller = cache(async () => {
  const heads = new Headers(await headers());
  const ctx = await createTRPCContext({ headers: heads, auth });
  return appRouter.createCaller(ctx);
});
