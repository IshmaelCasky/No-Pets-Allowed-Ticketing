import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatCentavos } from "~/lib/format";
import { StatusChip } from "../../../(public)/_components/status-chip";
import { getCaller } from "../../../(public)/_lib/caller";
import { PaymentStatus } from "./_components/payment-status";

export const metadata: Metadata = { title: "Your order · No Pets Allowed" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const caller = await getCaller();
  const order = await caller.order.byCode({ code });
  if (!order) notFound();

  // Resolve the event slug (if the show is published) so an unpaid buyer can
  // jump back to checkout. Falls back to null if it can't be resolved.
  const events = await caller.event.publicList();
  const slug = events.find((e) => e.id === order.eventId)?.slug ?? null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[oklch(0.68_0.018_309)]">Order</p>
          <h1 className="font-mono text-3xl font-black tracking-tight">
            {order.code}
          </h1>
        </div>
        <StatusChip kind="order" status={order.status} />
      </div>

      <div className="mt-4 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-5">
        <div className="flex items-center justify-between">
          <span className="text-[oklch(0.68_0.018_309)]">Amount</span>
          <span className="font-mono text-xl font-black text-[oklch(0.82_0.14_75)]">
            {formatCentavos(order.totalAmount)}
          </span>
        </div>
      </div>

      <PaymentStatus code={order.code} slug={slug} />
    </div>
  );
}
