import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCaller } from "../../../(public)/_lib/caller";
import { TicketView } from "./_components/ticket-view";

export const metadata: Metadata = { title: "Ticket · No Pets Allowed" };

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caller = await getCaller();
  const ticket = await caller.ticket.byId({ id });
  if (!ticket) notFound();

  // Resolve display label (event title) via public lookup.
  const publicEvents = await caller.event.publicList();
  const eventTitle =
    publicEvents.find((e) => e.id === ticket.eventId)?.title ?? "Your concert";

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <Link
        href="/my-tickets"
        className="text-sm text-[oklch(0.68_0.018_250)] hover:text-white"
      >
        ← My tickets
      </Link>
      <TicketView
        ticketId={ticket.id}
        token={ticket.token}
        status={ticket.status}
        holderName={ticket.holderName}
        eventTitle={eventTitle}
        usedAt={ticket.usedAt ? ticket.usedAt.toISOString() : null}
      />
    </div>
  );
}
