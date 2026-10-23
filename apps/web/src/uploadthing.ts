import {
  generateReactHelpers,
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";

import type { UploadRouter } from "~/app/api/uploadthing/core";

/**
 * Typed UploadThing client helpers, shared by admin surfaces
 * (`eventPoster`, `refundProof`).
 */
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<UploadRouter>();

export const UploadButton = generateUploadButton<UploadRouter>();
export const UploadDropzone = generateUploadDropzone<UploadRouter>();
