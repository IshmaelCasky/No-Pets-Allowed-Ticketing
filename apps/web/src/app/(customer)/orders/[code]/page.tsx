import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatCentavos, formatManila } from "~/lib/format";
import { StatusChip } from "../../../(public)/_components/status-chip";
import { getCaller } from "../../../(public)/_lib/caller";
import { PayPanel } from "./_components/pay-panel";

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

  const methods = await caller.paymentMethod.listActive();

  const payable =
    order.status === "pending_payment" || order.status === "rejected";

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
          <span className="text-[oklch(0.68_0.018_309)]">Amount to pay</span>
          <span className="font-mono text-xl font-black text-[oklch(0.82_0.14_75)]">
            {formatCentavos(order.totalAmount)}
          </span>
        </div>
        {order.submittedAt && (
          <p className="mt-2 text-xs text-[oklch(0.6_0.016_309)]">
            Submitted {formatManila(order.submittedAt)}
          </p>
        )}
      </div>

      {order.status === "for_review" && (
        <p className="mt-6 rounded-xl border border-[oklch(0.7_0.12_250)]/40 bg-[oklch(0.7_0.12_250)]/10 p-4 text-sm text-[oklch(0.82_0.1_250)]">
          Your payment is under review. We’ll email you once it’s approved —
          then your tickets appear in{" "}
          <Link href="/my-tickets" className="underline">
            My Tickets
          </Link>
          .
        </p>
      )}

      {order.status === "approved" && (
        <p className="mt-6 rounded-xl border border-[oklch(0.7_0.17_155)]/40 bg-[oklch(0.7_0.17_155)]/10 p-4 text-sm text-[oklch(0.82_0.15_155)]">
          Payment approved. Your tickets are ready in{" "}
          <Link href="/my-tickets" className="underline">
            My Tickets
          </Link>
          .
        </p>
      )}

      {(order.status === "expired" || order.status === "cancelled") && (
        <p className="mt-6 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-4 text-sm text-[oklch(0.68_0.018_309)]">
          This order is {order.status}. Reserved seats and tickets have been
          released.{" "}
          <Link
            href="/events"
            className="text-[oklch(0.72_0.17_348)] underline"
          >
            Browse shows
          </Link>
          .
        </p>
      )}

      {payable && (
        <PayPanel
          orderId={order.id}
          orderCode={order.code}
          expiresAt={order.expiresAt?.toISOString() ?? null}
          rejected={order.status === "rejected"}
          rejectionReason={order.rejectionReason}
          resubmitCount={order.resubmitCount}
          methods={methods.map((m) => ({
            id: m.id,
            label: m.label,
            accountName: m.accountName,
            accountNumber: m.accountNumber,
            qrImageUrl: m.qrImageUrl,
            instructions: m.instructions,
          }))}
        />
      )}
    </div>
  );
}
