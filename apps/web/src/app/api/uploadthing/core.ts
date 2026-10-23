import type { FileRouter } from "uploadthing/next";
import { headers as nextHeaders } from "next/headers";
import { createUploadthing } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import type { PermissionKey } from "@npa/validators";
import { appRouter, createTRPCContext } from "@npa/api";

import { auth } from "~/auth/server";

const f = createUploadthing();

/**
 * Shared UploadThing file router for the whole web app.
 *
 * - `refundProof` is PRIVATE (file keys only; the API resolves signed URLs so
 *   admins see all, customers see only their own). It is used by staff
 *   (Transactions → Refunds → Mark as paid).
 * - `eventPoster` is admin-only, gated by a permission key.
 *
 * All routes: images only (jpg/png/webp), max 4 MB. Middleware enforces auth
 * via better-auth; admin routes additionally require a permission key.
 */

const imageConstraints = {
  image: {
    maxFileSize: "4MB" as const,
    maxFileCount: 1,
    acl: "private" as const,
  },
};

const publicImageConstraints = {
  image: { maxFileSize: "4MB" as const, maxFileCount: 1 },
};

/** Resolve the signed-in user's id, throwing if unauthenticated. */
async function requireUser() {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- UploadThingError extends Error
    throw new UploadThingError("You must be signed in to upload");
  }
  return session.user;
}

/** Resolve the signed-in user's granted permission keys. */
async function userPermissions(): Promise<PermissionKey[]> {
  const heads = new Headers(await nextHeaders());
  const ctx = await createTRPCContext({ headers: heads, auth });
  const caller = appRouter.createCaller(ctx);
  const me = await caller.auth.me();
  return me.permissions;
}

async function requirePermission(key: PermissionKey) {
  const user = await requireUser();
  const permissions = await userPermissions();
  if (!permissions.includes(key)) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- UploadThingError extends Error
    throw new UploadThingError(`Missing permission: ${key}`);
  }
  return user;
}

export const uploadRouter = {
  /** Staff refund transfer receipt (private). */
  refundProof: f(imageConstraints)
    .middleware(async () => {
      const user = await requirePermission("refunds:review");
      return { userId: user.id };
    })
    .onUploadComplete(({ metadata, file }) => {
      return { uploadedBy: metadata.userId, key: file.key };
    }),

  /** Event poster (admin). */
  eventPoster: f(publicImageConstraints)
    .middleware(async () => {
      const user = await requirePermission("events:write");
      return { userId: user.id };
    })
    .onUploadComplete(({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
