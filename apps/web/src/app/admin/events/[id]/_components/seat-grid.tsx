"use client";

import { useMemo, useRef, useState } from "react";

import type { RouterOutputs } from "@npa/api";
import { cn } from "@npa/ui";

type Seat = RouterOutputs["seatMap"]["forEvent"]["seats"][number];

const STATUS_CLASS: Record<Seat["status"], string> = {
  available: "bg-emerald-500/80 hover:bg-emerald-500",
  held: "bg-amber-400",
  sold: "bg-rose-500",
  blocked: "bg-zinc-500",
};

/**
 * Renders one section's seats as a dense CSS grid. Click or drag across
 * available/blocked seats to toggle a selection; the parent applies the
 * block / unblock in bulk. Held/sold seats are not selectable.
 *
 * Uses plain divs so it stays responsive at 1,000+ seats.
 */
export function SeatGrid({
  seats,
  seatsPerRow,
  selected,
  onSelectionChange,
}: {
  seats: Seat[];
  seatsPerRow: number;
  selected: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
}) {
  const dragging = useRef(false);
  const dragAdds = useRef(true);
  const [, force] = useState(0);

  // Seats arrive ordered by rowLabel then number from the API.
  const rows = useMemo(() => {
    const byRow = new Map<string, Seat[]>();
    for (const s of seats) {
      const list = byRow.get(s.rowLabel) ?? [];
      list.push(s);
      byRow.set(s.rowLabel, list);
    }
    return [...byRow.entries()].map(([label, list]) => ({
      label,
      list: list.sort((a, b) => a.number - b.number),
    }));
  }, [seats]);

  const selectable = (s: Seat) =>
    s.status === "available" || s.status === "blocked";

  const applyToSeat = (s: Seat) => {
    if (!selectable(s)) return;
    const next = new Set(selected);
    if (dragAdds.current) next.add(s.id);
    else next.delete(s.id);
    onSelectionChange(next);
  };

  return (
    <div
      className="overflow-x-auto select-none"
      onMouseUp={() => {
        dragging.current = false;
      }}
      onMouseLeave={() => {
        dragging.current = false;
      }}
    >
      <div className="inline-flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1">
            <span className="text-muted-foreground w-6 shrink-0 text-right text-[10px]">
              {row.label}
            </span>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${seatsPerRow}, minmax(0, 1fr))`,
              }}
            >
              {row.list.map((s) => {
                const isSelected = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={`${s.label} (${s.status})`}
                    disabled={!selectable(s)}
                    onMouseDown={() => {
                      if (!selectable(s)) return;
                      dragging.current = true;
                      dragAdds.current = !selected.has(s.id);
                      applyToSeat(s);
                      force((n) => n + 1);
                    }}
                    onMouseEnter={() => {
                      if (dragging.current) applyToSeat(s);
                    }}
                    className={cn(
                      "size-4 rounded-[2px] transition-colors",
                      STATUS_CLASS[s.status],
                      isSelected && "ring-2 ring-sky-400 ring-offset-1",
                      !selectable(s) && "cursor-not-allowed opacity-70",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SeatLegend() {
  const items: { label: string; status: Seat["status"] }[] = [
    { label: "Available", status: "available" },
    { label: "Held", status: "held" },
    { label: "Sold", status: "sold" },
    { label: "Blocked", status: "blocked" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs">
      {items.map((i) => (
        <span key={i.status} className="flex items-center gap-1.5">
          <span
            className={cn("size-3 rounded-[2px]", STATUS_CLASS[i.status])}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
