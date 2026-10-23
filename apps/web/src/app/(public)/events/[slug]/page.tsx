import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatCentavos, formatManila } from "~/lib/format";
import { ShowCountdown } from "../../_components/countdown";
import { getCaller } from "../../_lib/caller";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const caller = await getCaller();
  const event = await caller.event.bySlug({ slug });
  return { title: event ? `${event.title} · No Pets Allowed` : "Concert" };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const caller = await getCaller();
  const event = await caller.event.bySlug({ slug });
  if (!event) notFound();

  const tiers =
    event.seatingMode === "ga"
      ? await caller.event.tiersByEvent({ eventId: event.id })
      : [];
  const sections =
    event.seatingMode === "reserved"
      ? (await caller.seatMap.forEvent({ eventId: event.id })).sections
      : [];

  const allSoldOut =
    event.seatingMode === "ga" &&
    tiers.length > 0 &&
    tiers.every((t) => t.capacity - t.reserved - t.sold <= 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Link
        href="/events"
        className="text-sm text-[oklch(0.68_0.018_250)] hover:text-white"
      >
        ← All concerts
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[2fr_3fr]">
        {/* poster */}
        <div className="overflow-hidden rounded-2xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)]">
          <div className="aspect-[3/4] w-full">
            {event.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.posterUrl}
                alt={event.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <span className="text-2xl font-black tracking-tight text-[oklch(0.45_0.05_250)] uppercase">
                  {event.title}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* details */}
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase sm:text-5xl">
            {event.title}
          </h1>
          <div className="mt-4 space-y-1 text-[oklch(0.78_0.012_250)]">
            {event.startsAt && <p>{formatManila(event.startsAt)}</p>}
            {event.doorsOpenAt && (
              <p className="text-sm text-[oklch(0.82_0.14_75)]">
                Doors {formatManila(event.doorsOpenAt)}
              </p>
            )}
            {event.venue && (
              <p className="text-[oklch(0.68_0.018_250)]">{event.venue}</p>
            )}
          </div>

          {event.lineup && (
            <p className="mt-4 text-[oklch(0.78_0.012_250)]">{event.lineup}</p>
          )}
          {event.description && (
            <p className="mt-4 whitespace-pre-line text-[oklch(0.68_0.018_250)]">
              {event.description}
            </p>
          )}

          {event.startsAt && (
            <div className="mt-8">
              <ShowCountdown target={event.startsAt} />
            </div>
          )}

          {/* pricing */}
          <div className="mt-10">
            <h2 className="text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_250)] uppercase">
              {event.seatingMode === "ga" ? "Ticket tiers" : "Sections"}
            </h2>
            <ul className="mt-4 divide-y divide-[oklch(0.3_0.018_250)]/60 rounded-xl border border-[oklch(0.3_0.018_250)]">
              {event.seatingMode === "ga" &&
                tiers.map((t) => {
                  const remaining = t.capacity - t.reserved - t.sold;
                  const soldOut = remaining <= 0;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between px-5 py-4"
                    >
                      <div className="flex items-center gap-3">
                        {t.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.imageUrl}
                            alt={t.name}
                            className="size-12 shrink-0 rounded-lg border border-[oklch(0.3_0.018_250)] object-cover"
                          />
                        )}
                        <div>
                          <p className="font-semibold">{t.name}</p>
                          <p
                            className={`text-sm ${soldOut ? "text-[oklch(0.72_0.19_25)]" : "text-[oklch(0.6_0.016_250)]"}`}
                          >
                            {soldOut ? "Sold out" : `${remaining} left`}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[oklch(0.82_0.14_75)]">
                        {formatCentavos(t.price)}
                      </span>
                    </li>
                  );
                })}
              {event.seatingMode === "reserved" &&
                sections.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      {s.color && (
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                      )}
                      <p className="font-semibold">{s.name}</p>
                    </div>
                    <span className="font-mono font-bold text-[oklch(0.82_0.14_75)]">
                      {formatCentavos(s.price)}
                    </span>
                  </li>
                ))}
              {tiers.length === 0 && sections.length === 0 && (
                <li className="px-5 py-4 text-sm text-[oklch(0.6_0.016_250)]">
                  Pricing announced soon.
                </li>
              )}
            </ul>
          </div>

          <div className="mt-8">
            {allSoldOut ? (
              <span className="inline-flex items-center justify-center rounded-full border border-[oklch(0.35_0.02_250)] px-8 py-3.5 text-sm font-semibold text-[oklch(0.68_0.018_250)]">
                Sold out
              </span>
            ) : (
              <Link
                href={`/checkout/${event.slug}`}
                className="inline-flex items-center justify-center rounded-full bg-[oklch(0.62_0.21_250)] px-8 py-3.5 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_250)]"
              >
                {event.seatingMode === "ga" ? "Buy tickets" : "Pick seats"}
              </Link>
            )}
            <p className="mt-3 text-xs text-[oklch(0.6_0.016_250)]">
              You’ll have 30 minutes to pay once you reserve. Refunds accepted
              until {event.refundCutoffDays} days before the concert.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
