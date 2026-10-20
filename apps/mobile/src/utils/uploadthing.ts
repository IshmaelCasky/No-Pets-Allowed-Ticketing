import type { FileRouter } from "uploadthing/types";
import { generateReactNativeHelpers } from "@uploadthing/expo";

import { getBaseUrl } from "./base-url";

/**
 * The mobile app uploads payment receipts to the SAME UploadThing backend that
 * the web app serves (`apps/web/src/app/api/uploadthing/core.ts`). We can't
 * import the web app's `UploadRouter` type (it lives in a Next.js app that
 * mobile does not depend on), so we declare the minimal router surface the
 * mobile client touches: the private `paymentProof` route, whose
 * `onUploadComplete` returns `{ uploadedBy, key }`.
 *
 * Keep this in sync with the web `uploadRouter`. Changing the web route shape
 * is a CONTRACT change — report it, don't diverge silently.
 */
export interface MobileUploadRouter extends FileRouter {
  paymentProof: FileRouter[string];
}

export const { useImageUploader } =
  generateReactNativeHelpers<MobileUploadRouter>({
    url: `${getBaseUrl()}/api/uploadthing`,
  });
