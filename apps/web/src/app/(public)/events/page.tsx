import type { Metadata } from "next";

import { ShowCard } from "../_components/show-card";
import { getCaller } from "../_lib/caller";

export const metadata: Metadata = {
  title: "Shows · No Pets Allowed",
};

export default async function EventsPage() {
  const caller = await getCaller();
  const events = await caller.event.publicList();

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="text-4xl font-black tracking-tight uppercase sm:text-5xl">
        All shows
      </h1>
      <p className="mt-3 text-[oklch(0.78_0.012_309)]">
        Every upcoming No Pets Allowed night. Tickets are limited.
      </p>

      {events.length === 0 ? (
        <div className="mt-12 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-10 text-center text-[oklch(0.68_0.018_309)]">
          No shows announced yet. Check back soon.
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {events.map((e) => (
            <ShowCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
