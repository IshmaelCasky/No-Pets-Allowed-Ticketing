"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { RequestRefundInput } from "@npa/validators";
import { toast } from "@npa/ui/toast";
import { requestRefundSchema } from "@npa/validators";

import { formatCentavos, formatManila, formatManilaDate } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { StatusChip } from "../../../(public)/_components/status-chip";

interface EligibleOrder {
  id: string;
  code: string;
  totalAmount: number;
  eventTitle: string;
  cutoff: string | null;
}

interface RefundRow {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  payoutMethod: string;
  payoutAccountName: string;
  rejectionReason: string | null;
  payoutReference: string | null;
  createdAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  orderCode: string;
  eventTitle: string | null;
}

export function RefundsClient({
  eligibleOrders,
  refunds,
}: {
  eligibleOrders: EligibleOrder[];
  refunds: RefundRow[];
}) {
  const [requestFor, setRequestFor] = useState<EligibleOrder | null>(null);

  return (
    <div className="mt-8 space-y-10">
      {eligibleOrders.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_250)] uppercase">
            Eligible for refund
          </h2>
          <ul className="space-y-3">
            {eligibleOrders.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-5"
              >
                <div>
                  <p className="font-bold">{o.eventTitle}</p>
                  <p className="font-mono text-sm text-[oklch(0.68_0.018_250)]">
                    {o.code} · {formatCentavos(o.totalAmount)}
                  </p>
                  {o.cutoff && (
                    <p className="text-xs text-[oklch(0.6_0.016_250)]">
                      Request by {formatManilaDate(o.cutoff)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setRequestFor(o)}
                  className="rounded-full border border-[oklch(0.35_0.02_250)] px-5 py-2 text-sm font-semibold hover:border-[oklch(0.62_0.21_250)]"
                >
                  Request refund
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_250)] uppercase">
          Your refund requests
        </h2>
        {refunds.length === 0 ? (
          <p className="text-sm text-[oklch(0.6_0.016_250)]">
            You haven’t requested any refunds.
          </p>
        ) : (
          <ul className="space-y-3">
            {refunds.map((r) => (
              <RefundCard key={r.id} refund={r} />
            ))}
          </ul>
        )}
      </section>

      {requestFor && (
        <RequestDialog order={requestFor} onClose={() => setRequestFor(null)} />
      )}
    </div>
  );
}

function RefundCard({ refund }: { refund: RefundRow }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const loadReceipt = async () => {
    setLoadingReceipt(true);
    try {
      const res = await queryClient.fetchQuery(
        trpc.refund.proofUrl.queryOptions({ refundRequestId: refund.id }),
      );
      if (res.url) setReceiptUrl(res.url);
      else toast.error("Receipt not available");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load receipt",
      );
    } finally {
      setLoadingReceipt(false);
    }
  };

  const steps: { label: string; at: string | null; done: boolean }[] = [
    { label: "Requested", at: refund.createdAt, done: true },
    {
      label: refund.status === "rejected" ? "Rejected" : "Approved",
      at: refund.reviewedAt,
      done:
        refund.status === "approved" ||
        refund.status === "paid" ||
        refund.status === "rejected",
    },
    {
      label: "Paid",
      at: refund.paidAt,
      done: refund.status === "paid",
    },
  ].filter((s) => !(refund.status === "rejected" && s.label === "Paid"));

  return (
    <li className="rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold">{refund.eventTitle ?? refund.orderCode}</p>
          <p className="font-mono text-sm text-[oklch(0.68_0.018_250)]">
            {refund.orderCode}
          </p>
        </div>
        <StatusChip kind="refund" status={refund.status} />
      </div>

      <p className="mt-3 text-sm text-[oklch(0.78_0.012_250)]">
        Reason: {refund.reason}
      </p>
      <p className="mt-1 text-xs text-[oklch(0.6_0.016_250)]">
        Payout to {refund.payoutMethod} · {refund.payoutAccountName}
      </p>

      {refund.status === "rejected" && refund.rejectionReason && (
        <p className="mt-3 rounded-lg border border-[oklch(0.64_0.21_25)]/40 bg-[oklch(0.64_0.21_25)]/10 p-3 text-sm text-[oklch(0.78_0.17_25)]">
          {refund.rejectionReason}
        </p>
      )}

      {/* timeline */}
      <ol className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span
              className={`size-2.5 rounded-full ${
                s.done
                  ? "bg-[oklch(0.7_0.17_155)]"
                  : "bg-[oklch(0.35_0.02_250)]"
              }`}
            />
            <span className={s.done ? "" : "text-[oklch(0.55_0.014_250)]"}>
              {s.label}
            </span>
            {s.at && (
              <span className="text-xs text-[oklch(0.6_0.016_250)]">
                {formatManila(s.at)}
              </span>
            )}
          </li>
        ))}
      </ol>

      {refund.status === "paid" && (
        <div className="mt-4">
          {refund.payoutReference && (
            <p className="text-xs text-[oklch(0.6_0.016_250)]">
              Transfer reference:{" "}
              <span className="font-mono">{refund.payoutReference}</span>
            </p>
          )}
          {receiptUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={receiptUrl}
              alt="Transfer receipt"
              className="mt-2 max-w-xs rounded-lg border border-[oklch(0.3_0.018_250)]"
            />
          ) : (
            <button
              type="button"
              disabled={loadingReceipt}
              onClick={loadReceipt}
              className="mt-2 text-sm font-semibold text-[oklch(0.72_0.17_250)] hover:underline disabled:opacity-50"
            >
              {loadingReceipt ? "Loading…" : "View transfer receipt"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function RequestDialog({
  order,
  onClose,
}: {
  order: EligibleOrder;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestRefundInput>({
    resolver: zodResolver(requestRefundSchema),
    defaultValues: { orderId: order.id },
  });

  const request = useMutation(
    trpc.refund.request.mutationOptions({
      onSuccess: () => {
        toast.success("Refund requested");
        onClose();
        router.refresh();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const onSubmit = handleSubmit((values) =>
    request.mutate({ ...values, orderId: order.id }),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Request refund</h2>
        <p className="mt-1 text-sm text-[oklch(0.68_0.018_250)]">
          {order.eventTitle} · {order.code} ·{" "}
          {formatCentavos(order.totalAmount)}
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="Reason" error={errors.reason?.message}>
            <textarea
              rows={3}
              placeholder="Tell us why you’re requesting a refund"
              {...register("reason")}
              className="w-full rounded-lg border border-[oklch(0.3_0.018_250)] bg-[oklch(0.16_0.012_250)] px-3.5 py-2.5 text-sm text-white placeholder:text-[oklch(0.55_0.014_250)] focus-visible:border-[oklch(0.62_0.21_250)] focus-visible:outline-none"
            />
          </Field>
          <Field label="Payout method" error={errors.payoutMethod?.message}>
            <Input
              placeholder="e.g. GCash, Maya, BPI"
              {...register("payoutMethod")}
            />
          </Field>
          <Field label="Account name" error={errors.payoutAccountName?.message}>
            <Input
              placeholder="Name on the account"
              {...register("payoutAccountName")}
            />
          </Field>
          <Field
            label="Account number"
            error={errors.payoutAccountNumber?.message}
          >
            <Input
              placeholder="Where we send the payout"
              {...register("payoutAccountNumber")}
            />
          </Field>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || request.isPending}
              className="rounded-full bg-[oklch(0.62_0.21_250)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[oklch(0.68_0.2_250)] disabled:opacity-50"
            >
              {request.isPending ? "Sending…" : "Submit request"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[oklch(0.35_0.02_250)] px-6 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[oklch(0.82_0.012_250)]">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-[oklch(0.72_0.19_25)]">{error}</p>
      )}
    </div>
  );
}

function Input(props: React.ComponentProps<"input">) {
  return (
    <input
      className="w-full rounded-lg border border-[oklch(0.3_0.018_250)] bg-[oklch(0.16_0.012_250)] px-3.5 py-2.5 text-sm text-white placeholder:text-[oklch(0.55_0.014_250)] focus-visible:border-[oklch(0.62_0.21_250)] focus-visible:outline-none"
      {...props}
    />
  );
}
