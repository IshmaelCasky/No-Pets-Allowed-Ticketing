"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { toast } from "@npa/ui/toast";

import { formatCentavos } from "~/lib/format";
import { useTRPC } from "~/trpc/react";

export function GaCheckout({
  eventId,
  maxPerOrder,
}: {
  eventId: string;
  maxPerOrder: number;
}) {
  const trpc = useTRPC();
  const [qty, setQty] = useState<Record<string, number>>({});

  const { data: tiers, isLoading } = useQuery(
    trpc.event.tiersByEvent.queryOptions({ eventId }),
  );

  const createOrder = useMutation(
    trpc.order.create.mutationOptions({
      onSuccess: ({ paymentUrl }) => {
        window.location.assign(paymentUrl);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const totalQty = useMemo(
    () => Object.values(qty).reduce((s, n) => s + n, 0),
    [qty],
  );
  const total = useMemo(() => {
    if (!tiers) return 0;
    return tiers.reduce((s, t) => s + (qty[t.id] ?? 0) * t.price, 0);
  }, [tiers, qty]);

  const setTier = (id: string, next: number) => {
    const clamped = Math.max(0, next);
    const others = totalQty - (qty[id] ?? 0);
    if (clamped + others > maxPerOrder) {
      toast.error(`Up to ${maxPerOrder} tickets per order`);
      return;
    }
    setQty((q) => ({ ...q, [id]: clamped }));
  };

  if (isLoading) {
    return <p className="text-[oklch(0.68_0.018_250)]">Loading tiers…</p>;
  }
  if (!tiers || tiers.length === 0) {
    return (
      <p className="text-[oklch(0.68_0.018_250)]">
        No tickets are on sale for this concert yet.
      </p>
    );
  }

  const submit = () => {
    const items = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([tierId, quantity]) => ({ tierId, quantity }));
    if (items.length === 0) {
      toast.error("Pick at least one ticket");
      return;
    }
    createOrder.mutate({ mode: "ga", eventId, items });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <ul className="space-y-3">
        {tiers.map((t) => {
          const remaining = t.capacity - t.reserved - t.sold;
          const soldOut = remaining <= 0;
          const now = new Date();
          const beforeSales =
            t.salesStartAt != null && new Date(t.salesStartAt) > now;
          const afterSales =
            t.salesEndAt != null && new Date(t.salesEndAt) < now;
          const notOnSale = beforeSales || afterSales;
          const current = qty[t.id] ?? 0;
          const disabled = soldOut || notOnSale;
          return (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-5"
            >
              <div className="flex items-center gap-4">
                {t.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.imageUrl}
                    alt={t.name}
                    className="size-16 shrink-0 rounded-lg border border-[oklch(0.3_0.018_250)] object-cover"
                  />
                )}
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="font-mono text-sm text-[oklch(0.82_0.14_75)]">
                    {formatCentavos(t.price)}
                  </p>
                  <p
                    className={`text-xs ${soldOut ? "text-[oklch(0.72_0.19_25)]" : "text-[oklch(0.6_0.016_250)]"}`}
                  >
                    {soldOut
                      ? "Sold out"
                      : notOnSale
                        ? "Not on sale"
                        : `${remaining} left`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={disabled || current === 0}
                  onClick={() => setTier(t.id, current - 1)}
                  className="size-9 rounded-full border border-[oklch(0.35_0.02_250)] text-lg font-bold disabled:opacity-40"
                  aria-label={`Remove one ${t.name}`}
                >
                  −
                </button>
                <span className="w-6 text-center font-mono font-bold tabular-nums">
                  {current}
                </span>
                <button
                  type="button"
                  disabled={disabled || current >= remaining}
                  onClick={() => setTier(t.id, current + 1)}
                  className="size-9 rounded-full border border-[oklch(0.35_0.02_250)] text-lg font-bold disabled:opacity-40"
                  aria-label={`Add one ${t.name}`}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-6">
        <h2 className="text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_250)] uppercase">
          Summary
        </h2>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-[oklch(0.68_0.018_250)]">Tickets</span>
          <span className="font-mono">{totalQty}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="font-mono text-lg font-black text-[oklch(0.82_0.14_75)]">
            {formatCentavos(total)}
          </span>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={createOrder.isPending || totalQty === 0}
          className="mt-6 w-full rounded-full bg-[oklch(0.62_0.21_250)] px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_250)] disabled:opacity-50"
        >
          {createOrder.isPending ? "Reserving…" : "Reserve & pay"}
        </button>
        <p className="mt-3 text-xs text-[oklch(0.6_0.016_250)]">
          We’ll hold these for 30 minutes while you pay.
        </p>
      </aside>
    </div>
  );
}
