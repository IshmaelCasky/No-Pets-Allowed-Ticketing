import Link from "next/link";

import { formatCentavos, formatManila } from "~/lib/format";
import { ShowCountdown } from "./(public)/_components/countdown";
import { ShowCard } from "./(public)/_components/show-card";
import { SiteFooter } from "./(public)/_components/site-footer";
import { SiteNav } from "./(public)/_components/site-nav";
import { getCaller } from "./(public)/_lib/caller";

export default async function LandingPage() {
  const caller = await getCaller();
  const events = await caller.event.publicList();

  const upcoming = events; // publicList is already published + sorted by date
  const featured = upcoming[0] ?? null;
  const featuredTiers = featured
    ? await caller.event.tiersByEvent({ eventId: featured.id })
    : [];

  return (
    <div className="dark flex min-h-screen flex-col bg-[oklch(0.16_0.012_250)] text-[oklch(0.97_0.006_250)]">
      <SiteNav />

      <main className="flex-1">
        {/* ---------------------------------------------------------- hero */}
        <section className="relative overflow-hidden border-b border-[oklch(0.3_0.018_250)]/60">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[oklch(0.62_0.21_250)]/25 blur-[120px]"
          />
          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-[oklch(0.72_0.17_250)]">
              {featured ? "Next concert" : "No Pets Allowed"}
            </p>
            <h1 className="mt-4 max-w-4xl font-black tracking-tight uppercase">
              <span className="block text-5xl leading-[0.95] sm:text-7xl lg:text-8xl">
                {featured ? featured.title : "Live music,"}
              </span>
              {!featured && (
                <span className="block text-5xl leading-[0.95] text-[oklch(0.72_0.17_250)] sm:text-7xl lg:text-8xl">
                  loud nights.
                </span>
              )}
            </h1>
            {featured && (
              <p className="mt-6 text-lg text-[oklch(0.78_0.012_250)]">
                {formatManila(featured.startsAt)}
                {featured.venue ? ` · ${featured.venue}` : ""}
              </p>
            )}
            {featured?.lineup && (
              <p className="mt-2 max-w-2xl text-[oklch(0.68_0.018_250)]">
                {featured.lineup}
              </p>
            )}
            <div className="mt-9 flex flex-wrap gap-4">
              {featured ? (
                <Link
                  href={`/events/${featured.slug}`}
                  className="inline-flex items-center justify-center rounded-full bg-[oklch(0.62_0.21_250)] px-8 py-3.5 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_250)]"
                >
                  Get tickets
                </Link>
              ) : null}
              <Link
                href="/events"
                className="inline-flex items-center justify-center rounded-full border border-[oklch(0.35_0.02_250)] px-8 py-3.5 text-sm font-semibold tracking-wide transition-colors hover:border-[oklch(0.62_0.21_250)]"
              >
                See all concerts
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- upcoming concerts */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-black tracking-tight uppercase sm:text-4xl">
              Upcoming concerts
            </h2>
            <Link
              href="/events"
              className="text-sm font-semibold text-[oklch(0.72_0.17_250)] hover:underline"
            >
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-8 text-[oklch(0.68_0.018_250)]">
              No concerts announced yet. Check back soon.
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {upcoming.slice(0, 8).map((e) => (
                <ShowCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>

        {/* --------------------------------------- featured countdown + tiers */}
        {featured && (
          <section className="border-y border-[oklch(0.3_0.018_250)]/60 bg-[oklch(0.14_0.011_250)]">
            <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold tracking-widest text-[oklch(0.72_0.17_250)]">
                  Doors in
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight uppercase sm:text-4xl">
                  {featured.title}
                </h2>
                {featured.startsAt && (
                  <div className="mt-6">
                    <ShowCountdown target={featured.startsAt} />
                  </div>
                )}
                <Link
                  href={`/events/${featured.slug}`}
                  className="mt-8 inline-flex items-center justify-center rounded-full bg-[oklch(0.62_0.21_250)] px-7 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_250)]"
                >
                  Get tickets
                </Link>
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_250)] uppercase">
                  Ticket types
                </h3>
                <ul className="mt-4 divide-y divide-[oklch(0.3_0.018_250)]/60 rounded-xl border border-[oklch(0.3_0.018_250)]">
                  {featuredTiers
                    .map((t) => ({
                      id: t.id,
                      name: t.name,
                      price: t.price,
                      note:
                        t.capacity - t.reserved - t.sold <= 0
                          ? "Sold out"
                          : `${t.capacity - t.reserved - t.sold} left`,
                    }))
                    .map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between px-5 py-4"
                      >
                        <div>
                          <p className="font-semibold">{row.name}</p>
                          <p className="text-sm text-[oklch(0.6_0.016_250)]">
                            {row.note}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-[oklch(0.82_0.14_75)]">
                          {formatCentavos(row.price)}
                        </span>
                      </li>
                    ))}
                  {featuredTiers.length === 0 && (
                    <li className="px-5 py-4 text-sm text-[oklch(0.6_0.016_250)]">
                      Pricing announced soon.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* --------------------------------------------------- how to buy */}
        <section id="how-to-buy" className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-black tracking-tight uppercase sm:text-4xl">
            How to buy
          </h2>
          <p className="mt-3 max-w-2xl text-[oklch(0.78_0.012_250)]">
            No card checkout here — you pay manually and we confirm it. You get{" "}
            <span className="font-semibold text-[oklch(0.82_0.14_75)]">
              30 minutes
            </span>{" "}
            to pay once you reserve, so have your e-wallet ready.
          </p>
          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Pay via QR",
                body: "Reserve your seats or tier, then scan the GCash, Maya or bank QR and send the exact amount within the 30-minute window.",
              },
              {
                step: "02",
                title: "Upload your receipt",
                body: "Snap the payment receipt and enter the reference number. We review it and confirm your order.",
              },
              {
                step: "03",
                title: "Get your QR ticket",
                body: "Once approved, your QR ticket appears in My Tickets. Show it at the gate to get scanned in.",
              },
            ].map((s) => (
              <li
                key={s.step}
                className="rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-6"
              >
                <span className="font-mono text-sm font-bold text-[oklch(0.72_0.17_250)]">
                  {s.step}
                </span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-[oklch(0.68_0.018_250)]">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------- about */}
        <section className="border-y border-[oklch(0.3_0.018_250)]/60 bg-[oklch(0.14_0.011_250)]">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-3xl font-black tracking-tight uppercase sm:text-4xl">
              About the night
            </h2>
            <p className="mt-4 max-w-3xl text-lg text-[oklch(0.78_0.012_250)]">
              No Pets Allowed is a live-music series built around loud rooms and
              louder crowds. Every concert is a single, unrepeatable night —
              real bands, real sweat, no autotune. Tickets are limited and paid
              by QR, so grab yours before the room fills up.
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------- FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="text-3xl font-black tracking-tight uppercase sm:text-4xl">
            FAQ
          </h2>
          <div className="mt-8 space-y-3">
            {[
              {
                q: "How long do I have to pay?",
                a: "You have a 30-minute payment window from the moment you reserve. Your seats or tickets are held during that time; if payment isn't confirmed, they're released back to everyone else.",
              },
              {
                q: "How do I pay?",
                a: "Scan the posted QR for GCash, Maya or bank transfer, send the exact amount, then upload the receipt and reference number. Staff review it and approve your order.",
              },
              {
                q: "My receipt was rejected — now what?",
                a: "You can re-upload a corrected receipt once, as long as you're still inside the 30-minute window.",
              },
              {
                q: "Can I get a refund?",
                a: "Yes. You can request a refund in-app on an approved order up until the refund cutoff before the concert (set per concert, typically 7 days before). Used tickets can't be refunded.",
              },
              {
                q: "How do I get into the concert?",
                a: "Open My Tickets, show the full-screen QR ticket at the gate, and staff scan you in. Each ticket scans once.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] px-5 py-4"
              >
                <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-[oklch(0.72_0.17_250)] transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-[oklch(0.78_0.012_250)]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
