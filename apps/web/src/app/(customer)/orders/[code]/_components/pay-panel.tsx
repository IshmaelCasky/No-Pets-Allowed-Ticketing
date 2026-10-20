"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { toast } from "@npa/ui/toast";

import { useTRPC } from "~/trpc/react";
import { useUploadThing } from "~/uploadthing";
import { PaymentCountdown } from "../../../../(public)/_components/countdown";

interface Method {
  id: string;
  label: string;
  accountName: string | null;
  accountNumber: string | null;
  qrImageUrl: string | null;
  instructions: string | null;
}

export function PayPanel({
  orderId,
  orderCode,
  expiresAt,
  rejected,
  rejectionReason,
  resubmitCount,
  methods,
}: {
  orderId: string;
  orderCode: string;
  expiresAt: string | null;
  rejected: boolean;
  rejectionReason: string | null;
  resubmitCount: number;
  methods: Method[];
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const [activeId, setActiveId] = useState(methods[0]?.id ?? "");
  const [reference, setReference] = useState("");
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [windowClosed, setWindowClosed] = useState(false);

  // A rejected order may be re-submitted only once.
  const usedUpResubmit = rejected && resubmitCount >= 1;

  const { startUpload, isUploading } = useUploadThing("paymentProof", {
    onClientUploadComplete: (res) => {
      const first = res[0];
      if (first) {
        setProofKey(first.key);
        toast.success("Receipt uploaded");
      }
    },
    onUploadError: (e) => {
      toast.error(e.message);
    },
  });

  const submitProof = useMutation(
    trpc.order.submitProof.mutationOptions({
      onSuccess: () => {
        toast.success("Submitted for review");
        router.refresh();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const active = methods.find((m) => m.id === activeId);

  const submit = () => {
    if (!active) {
      toast.error("Pick a payment method");
      return;
    }
    if (!reference.trim()) {
      toast.error("Enter the reference number");
      return;
    }
    if (!proofKey) {
      toast.error("Upload your receipt");
      return;
    }
    submitProof.mutate({
      orderId,
      paymentMethodId: active.id,
      referenceNumber: reference.trim(),
      proofImageKey: proofKey,
    });
  };

  if (methods.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-4 text-sm text-[oklch(0.68_0.018_309)]">
        No payment methods are configured yet. Please check back shortly.
      </p>
    );
  }

  const canSubmit =
    !windowClosed && !usedUpResubmit && !submitProof.isPending && !isUploading;

  return (
    <div className="mt-6 space-y-6">
      {/* countdown */}
      {expiresAt && (
        <div className="flex items-center justify-between rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Pay within</p>
            <p className="text-xs text-[oklch(0.6_0.016_309)]">
              Your reservation is released when this hits zero.
            </p>
          </div>
          <PaymentCountdown
            expiresAt={expiresAt}
            onExpire={() => setWindowClosed(true)}
          />
        </div>
      )}

      {rejected && rejectionReason && !usedUpResubmit && (
        <p className="rounded-xl border border-[oklch(0.64_0.21_25)]/40 bg-[oklch(0.64_0.21_25)]/10 p-4 text-sm text-[oklch(0.78_0.17_25)]">
          Your last receipt was rejected: {rejectionReason}. You can re-upload a
          corrected receipt once, before the window closes.
        </p>
      )}

      {usedUpResubmit && (
        <p className="rounded-xl border border-[oklch(0.64_0.21_25)]/40 bg-[oklch(0.64_0.21_25)]/10 p-4 text-sm text-[oklch(0.78_0.17_25)]">
          This order was rejected and you’ve already re-submitted once. Please
          start a new order.
        </p>
      )}

      {windowClosed && (
        <p className="rounded-xl border border-[oklch(0.64_0.21_25)]/40 bg-[oklch(0.64_0.21_25)]/10 p-4 text-sm text-[oklch(0.78_0.17_25)]">
          The 30-minute payment window has closed. This reservation has been
          released.
        </p>
      )}

      {/* method tabs */}
      <div>
        <div className="flex flex-wrap gap-2">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveId(m.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                m.id === activeId
                  ? "bg-[oklch(0.62_0.21_350)] text-white"
                  : "border border-[oklch(0.35_0.02_310)] text-[oklch(0.78_0.012_309)] hover:border-[oklch(0.62_0.21_350)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {active && (
          <div className="mt-4 grid gap-6 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-5 sm:grid-cols-2">
            <div>
              {active.qrImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.qrImageUrl}
                  alt={`${active.label} QR code`}
                  className="w-full max-w-[240px] rounded-lg border border-[oklch(0.3_0.018_310)] bg-white"
                />
              ) : (
                <div className="flex aspect-square max-w-[240px] items-center justify-center rounded-lg border border-dashed border-[oklch(0.35_0.02_310)] text-sm text-[oklch(0.6_0.016_309)]">
                  No QR provided
                </div>
              )}
            </div>
            <dl className="space-y-3 text-sm">
              {active.accountName && (
                <div>
                  <dt className="text-[oklch(0.6_0.016_309)]">Account name</dt>
                  <dd className="font-semibold">{active.accountName}</dd>
                </div>
              )}
              {active.accountNumber && (
                <div>
                  <dt className="text-[oklch(0.6_0.016_309)]">
                    Account number
                  </dt>
                  <dd className="font-mono font-semibold">
                    {active.accountNumber}
                  </dd>
                </div>
              )}
              {active.instructions && (
                <div>
                  <dt className="text-[oklch(0.6_0.016_309)]">Instructions</dt>
                  <dd className="whitespace-pre-line text-[oklch(0.78_0.012_309)]">
                    {active.instructions}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* proof form */}
      <div className="rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-5">
        <h2 className="text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_309)] uppercase">
          Upload your receipt
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Reference number
            </label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. 0123 4567 8901"
              className="w-full rounded-lg border border-[oklch(0.3_0.018_310)] bg-[oklch(0.16_0.012_312)] px-3.5 py-2.5 text-sm text-white placeholder:text-[oklch(0.55_0.014_309)] focus-visible:border-[oklch(0.62_0.21_350)] focus-visible:outline-none"
            />
          </div>

          <div className="flex items-center gap-4">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Receipt preview"
                className="size-20 rounded-md border border-[oklch(0.3_0.018_310)] object-cover"
              />
            )}
            <div>
              <input
                id="receipt-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isUploading}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPreview(URL.createObjectURL(file));
                    void startUpload([file]);
                  }
                }}
              />
              <label
                htmlFor="receipt-upload"
                className="inline-flex cursor-pointer items-center rounded-full border border-[oklch(0.35_0.02_310)] px-4 py-2 text-sm font-semibold hover:border-[oklch(0.62_0.21_350)]"
              >
                {isUploading
                  ? "Uploading…"
                  : proofKey
                    ? "Replace receipt"
                    : "Choose receipt"}
              </label>
              <p className="mt-1 text-xs text-[oklch(0.6_0.016_309)]">
                JPG/PNG/WEBP, max 4&nbsp;MB
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full rounded-full bg-[oklch(0.62_0.21_350)] px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_349)] disabled:opacity-50"
          >
            {submitProof.isPending
              ? "Submitting…"
              : rejected
                ? "Re-submit for review"
                : "Submit for review"}
          </button>
          <p className="text-center text-xs text-[oklch(0.55_0.014_309)]">
            Order {orderCode}
          </p>
        </div>
      </div>
    </div>
  );
}
