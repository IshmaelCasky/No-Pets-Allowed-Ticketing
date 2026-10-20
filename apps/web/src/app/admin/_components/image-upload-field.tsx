"use client";

import { useState } from "react";

import { Button } from "@npa/ui/button";
import { toast } from "@npa/ui/toast";

import type { UploadRouter } from "~/app/api/uploadthing/core";
import { useUploadThing } from "~/uploadthing";

type ImageEndpoint = keyof UploadRouter;

/**
 * Upload a single image to an UploadThing route and report back the resulting
 * file key (for private routes) or URL (for admin poster/QR routes).
 */
export function ImageUploadField({
  endpoint,
  value,
  onUploaded,
  label = "Upload image",
}: {
  endpoint: ImageEndpoint;
  /** Current preview URL (if any). */
  value?: string | null;
  onUploaded: (result: { key: string; url?: string }) => void;
  label?: string;
}) {
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onClientUploadComplete: (res) => {
      const first = res[0];
      if (!first) return;
      const url = "url" in first ? first.url : undefined;
      onUploaded({ key: first.key, url });
      if (url) setPreview(url);
      toast.success("Upload complete");
    },
    onUploadError: (e) => {
      toast.error(e.message);
    },
  });

  return (
    <div className="flex items-center gap-4">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="preview"
          className="size-20 rounded-md border object-cover"
        />
      )}
      <div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isUploading}
          className="hidden"
          id={`upload-${endpoint}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setPreview(URL.createObjectURL(file));
              void startUpload([file]);
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" asChild>
          <label htmlFor={`upload-${endpoint}`} className="cursor-pointer">
            {isUploading ? "Uploading…" : label}
          </label>
        </Button>
        <p className="text-muted-foreground mt-1 text-xs">
          JPG/PNG/WEBP, max 4&nbsp;MB
        </p>
      </div>
    </div>
  );
}
