import type { Metadata } from "next";
import Link from "next/link";

import type { Event } from "@npa/db/schema";

import { formatManila } from "~/lib/format";
import { StatusChip } from "../../(public)/_components/status-chip";
import { getCaller } from "../../(public)/_lib/caller";

export const metadata: Metadata = { title: "My Tickets · No Pets Allowed" };

const GROUPS: { key: "active" | "used" | "void"; title: string }[] = [
  { key: "active", title: "Active" },
  { key: "used", title: "Checked in" },
  { key: "void", title: "Void" },
];

export default async function MyTicketsPage() {
  const caller = await getCaller();
  const [tickets, orders, publicEvents] = await Promise.all([
    caller.ticket.myTickets(),
    caller.order.myOrders(),
    caller.event.publicList(),
  ]);

  const eventTitle = new Map<string, string>();
  publicEvents.forEach((e: Event) => eventTitle.set(e.id, e.title));

  const orderByEvent = new Map<string, string>(); // eventId -> first order code
  orders.forEach((o) => {
    if (!orderByEvent.has(o.eventId)) orderByEvent.set(o.eventId, o.code);
  });

  // Resolve ticket-type names per ticket (tierId -> name).
  const ticketEventIds = [...new Set(tickets.map((t) => t.eventId))];
  const tierName = new Map<string, string>();
  await Promise.all(
    ticketEventIds.map(async (eventId) => {
      const tiers = await caller.event.tiersByEvent({ eventId });
      tiers.forEach((t) => tierName.set(t.id, t.name));
    }),
  );

  const grouped = {
    active: tickets.filter((t) => t.status === "active"),
    used: tickets.filter((t) => t.status === "used"),
    void: tickets.filter((t) => t.status === "void"),
  };

  const hasAny = tickets.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl">
        My tickets
      </h1>

      {!hasAny ? (
        <div className="mt-10 rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-10 text-center">
          <p className="text-[oklch(0.68_0.018_250)]">
            You don’t have any tickets yet.
          </p>
          <Link
            href="/events"
            className="mt-4 inline-flex rounded-full bg-[oklch(0.62_0.21_250)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[oklch(0.68_0.2_250)]"
          >
            Browse concerts
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {GROUPS.map((g) => {
            const list = grouped[g.key];
            if (list.length === 0) return null;
            return (
              <section key={g.key}>
                <h2 className="mb-4 text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_250)] uppercase">
                  {g.title} · {list.length}
                </h2>
                <ul className="space-y-3">
                  {list.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/tickets/${t.id}`}
                        className="flex items-center justify-between rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-5 transition-colors hover:border-[oklch(0.62_0.21_250)]"
                      >
                        <div>
                          <p className="font-bold">
                            {eventTitle.get(t.eventId) ??
                              orderByEvent.get(t.eventId) ??
                              "Concert"}
                          </p>
                          <p className="text-sm text-[oklch(0.68_0.018_250)]">
                            {(t.tierId && tierName.get(t.tierId)) ?? "Ticket"}
                          </p>
                          {t.holderName && (
                            <p className="text-xs text-[oklch(0.6_0.016_250)]">
                              {t.holderName}
                            </p>
                          )}
                          {t.status === "used" && t.usedAt && (
                            <p className="text-xs text-[oklch(0.6_0.016_250)]">
                              Checked in {formatManila(t.usedAt)}
                            </p>
                          )}
                        </div>
                        <StatusChip kind="ticket" status={t.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
