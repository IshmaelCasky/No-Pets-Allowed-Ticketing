import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { appRouter, createTRPCContext } from "@npa/api";

import { auth } from "~/auth/server";

/**
 * A server-side tRPC caller for RSC data fetching in the admin area. Invokes
 * procedures in-process (no HTTP round-trip) with the request's auth context.
 */
export const getAdminCaller = cache(async () => {
  const heads = new Headers(await headers());
  const ctx = await createTRPCContext({ headers: heads, auth });
  return appRouter.createCaller(ctx);
});
