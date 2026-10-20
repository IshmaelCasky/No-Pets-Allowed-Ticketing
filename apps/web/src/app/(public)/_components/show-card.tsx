import Link from "next/link";

import type { Event } from "@npa/db/schema";

import { formatManila } from "~/lib/format";

/** A poster-forward card for an upcoming show. */
export function ShowCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] transition-colors hover:border-[oklch(0.62_0.21_350)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[oklch(0.24_0.015_311)]">
        {event.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.posterUrl}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <span className="font-black tracking-tight text-[oklch(0.45_0.05_348)] uppercase">
              {event.title}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-bold tracking-tight">{event.title}</h3>
        <p className="text-sm text-[oklch(0.68_0.018_309)]">
          {formatManila(event.startsAt)}
        </p>
        {event.venue && (
          <p className="text-sm text-[oklch(0.6_0.016_309)]">{event.venue}</p>
        )}
        <span className="mt-3 text-sm font-semibold text-[oklch(0.72_0.17_348)]">
          Get tickets
        </span>
      </div>
    </Link>
  );
}
