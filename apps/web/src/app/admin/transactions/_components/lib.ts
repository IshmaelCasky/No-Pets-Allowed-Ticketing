import type { TRPCClientErrorLike } from "@trpc/client";

import type { AppRouter } from "@npa/api";

type ApiError = TRPCClientErrorLike<AppRouter>;

/** Treat a tRPC error as a review conflict ("already reviewed"). */
export function isConflict(err: ApiError): boolean {
  return (
    err.data?.code === "CONFLICT" ||
    err.message.toLowerCase().includes("already reviewed")
  );
}

/** UploadThing public CDN URL for a stored file key. */
export function uploadThingUrl(key: string): string {
  return `https://utfs.io/f/${key}`;
}

export const PAGE_SIZE = 20;
