import type { FileRouter } from "uploadthing/types";
import { generateReactNativeHelpers } from "@uploadthing/expo";

import { getBaseUrl } from "./base-url";

/**
 * The mobile app uploads to the SAME UploadThing backend that the web app
 * serves (`apps/web/src/app/api/uploadthing/core.ts`). We can't import the web
 * app's `UploadRouter` type (it lives in a Next.js app mobile doesn't depend
 * on), so we declare the routes the mobile admin uses:
 * - `refundProof` (private, `refunds:review`) — payout transfer receipt
 * - `eventPoster` (public, `events:write`) — event poster image
 *
 * The web route middleware authenticates via the better-auth session cookie,
 * so pass `headers: { Cookie: authClient.getCookie() }` when uploading.
 *
 * Keep this in sync with the web `uploadRouter`. Changing the web route shape
 * is a CONTRACT change — report it, don't diverge silently.
 */
export interface MobileUploadRouter extends FileRouter {
  refundProof: FileRouter[string];
  eventPoster: FileRouter[string];
}

export const { useImageUploader } =
  generateReactNativeHelpers<MobileUploadRouter>({
    url: `${getBaseUrl()}/api/uploadthing`,
  });
