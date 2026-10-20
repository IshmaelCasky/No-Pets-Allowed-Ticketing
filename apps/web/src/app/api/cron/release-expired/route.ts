import type { NextRequest } from "next/server";

import { createCaller, createTRPCContext } from "@npa/api";

import { auth } from "~/auth/server";
import { env } from "~/env";

/**
 * Vercel cron (every 5 min) → release expired, unpaid orders and free their
 * held inventory. Vercel attaches `Authorization: Bearer $CRON_SECRET`; we
 * forward the headers so `order.releaseExpired` can verify the secret.
 */
const handler = async (req: NextRequest) => {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const ctx = await createTRPCContext({ auth, headers: req.headers });
  const result = await createCaller(ctx).order.releaseExpired();
  return Response.json(result);
};

export { handler as GET, handler as POST };
