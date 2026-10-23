"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

/**
 * Payment status / return view.
 *
 * HitPay redirects the buyer back to this order page after hosted checkout.
 * On mount we reconcile the order against HitPay once (`order.syncPayment`),
 * then poll `order.byCode` a few times while it is still `pending_payment`
 * in case the webhook is slightly delayed.
 */
export function PaymentStatus({
  code,
  slug,
}: {
  code: string;
  slug: string | null;
}) {
  const trpc = useTRPC();

  const syncPayment = useMutation(trpc.order.syncPayment.mutationOptions());
  const syncedRef = useRef(false);

  const { data: order, refetch } = useQuery(
    trpc.order.byCode.queryOptions({ code }),
  );

  const status = order?.status;
  const isPending = status === "pending_payment";

  // Reconcile once on mount, then refresh the order view.
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    syncPayment.mutate(
      { code },
      {
        onSettled: () => {
          void refetch();
        },
      },
    );
  }, [code, syncPayment, refetch]);

  // Poll a few times while still pending (webhook may lag behind the redirect).
  const pollsRef = useRef(0);
  useEffect(() => {
    if (!isPending) return;
    if (pollsRef.current >= 6) return;
    const id = setTimeout(() => {
      pollsRef.current += 1;
      void refetch();
    }, 3000);
    return () => clearTimeout(id);
  }, [isPending, order, refetch]);

  if (status === "approved") {
    return (
      <p className="mt-6 rounded-xl border border-[oklch(0.7_0.17_155)]/40 bg-[oklch(0.7_0.17_155)]/10 p-4 text-sm text-[oklch(0.82_0.15_155)]">
        Payment confirmed. Your tickets are ready in{" "}
        <Link href="/my-tickets" className="underline">
          My Tickets
        </Link>
        .
      </p>
    );
  }

  if (status === "refunded") {
    return (
      <p className="mt-6 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-4 text-sm text-[oklch(0.68_0.018_309)]">
        This order has been refunded.
      </p>
    );
  }

  if (status === "expired" || status === "cancelled") {
    return (
      <p className="mt-6 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-4 text-sm text-[oklch(0.68_0.018_309)]">
        This order is {status}. Reserved seats and tickets have been released.{" "}
        <Link href="/events" className="text-[oklch(0.72_0.17_348)] underline">
          Browse shows
        </Link>
        .
      </p>
    );
  }

  // pending_payment (or still loading)
  return (
    <div className="mt-6 rounded-xl border border-[oklch(0.7_0.12_250)]/40 bg-[oklch(0.7_0.12_250)]/10 p-5 text-sm text-[oklch(0.82_0.1_250)]">
      <p className="font-semibold">Waiting for payment confirmation…</p>
      <p className="mt-1 text-[oklch(0.78_0.08_250)]">
        This can take a few moments after you pay. Your tickets appear in{" "}
        <Link href="/my-tickets" className="underline">
          My Tickets
        </Link>{" "}
        once confirmed.
      </p>
      {slug && (
        <Link
          href={`/checkout/${slug}`}
          className="mt-4 inline-flex rounded-full bg-[oklch(0.62_0.21_350)] px-5 py-2 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_349)]"
        >
          Pay now
        </Link>
      )}
    </div>
  );
}
