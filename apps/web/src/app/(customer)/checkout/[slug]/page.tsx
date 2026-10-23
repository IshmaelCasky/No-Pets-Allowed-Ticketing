import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCaller } from "../../../(public)/_lib/caller";
import { GaCheckout } from "./_components/ga-checkout";

export const metadata: Metadata = { title: "Checkout · No Pets Allowed" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await getCaller();
  const event = await caller.event.bySlug({ slug });
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl">
        {event.title}
      </h1>
      <p className="mt-2 text-sm text-[oklch(0.68_0.018_250)]">
        Pick your tickets. You’ll have 30 minutes to pay once you reserve — up
        to {event.maxPerOrder} per order.
      </p>

      <div className="mt-8">
        <GaCheckout eventId={event.id} maxPerOrder={event.maxPerOrder} />
      </div>
    </div>
  );
}
