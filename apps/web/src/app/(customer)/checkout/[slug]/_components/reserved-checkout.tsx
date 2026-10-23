"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Seat, SeatSection } from "@npa/db/schema";
import { toast } from "@npa/ui/toast";

import { formatCentavos } from "~/lib/format";
import { useTRPC } from "~/trpc/react";

/** Fallback palette when a section has no color set. */
const FALLBACK = "oklch(0.62 0.21 250)";

export function ReservedCheckout({
  eventId,
  maxPerOrder,
}: {
  eventId: string;
  maxPerOrder: number;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);

  const mapOptions = trpc.seatMap.forEvent.queryOptions({ eventId });
  // Poll every 10s so the live availability stays fresh during checkout.
  const { data, isLoading } = useQuery({
    ...mapOptions,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const refreshMap = () =>
    queryClient.invalidateQueries(trpc.seatMap.forEvent.queryFilter());

  const createOrder = useMutation(
    trpc.order.create.mutationOptions({
      onSuccess: ({ paymentUrl }) => {
        window.location.assign(paymentUrl);
      },
      onError: async (err) => {
        if (err.data?.code === "CONFLICT") {
          toast.error(
            "Some of those seats were just taken. We’ve refreshed the map — please pick again.",
          );
          setSelected(new Set());
          await refreshMap();
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  const sectionById = useMemo(() => {
    const m = new Map<string, SeatSection>();
    data?.sections.forEach((s) => m.set(s.id, s));
    return m;
  }, [data?.sections]);

  const seatsBySection = useMemo(() => {
    const m = new Map<string, Seat[]>();
    data?.seats.forEach((s) => {
      const arr = m.get(s.sectionId) ?? [];
      arr.push(s);
      m.set(s.sectionId, arr);
    });
    return m;
  }, [data?.seats]);

  const total = useMemo(() => {
    let t = 0;
    for (const id of selected) {
      const seat = data?.seats.find((s) => s.id === id);
      if (seat) t += sectionById.get(seat.sectionId)?.price ?? 0;
    }
    return t;
  }, [selected, data?.seats, sectionById]);

  if (isLoading) {
    return <p className="text-[oklch(0.68_0.018_250)]">Loading seat map…</p>;
  }
  if (!data || data.sections.length === 0) {
    return (
      <p className="text-[oklch(0.68_0.018_250)]">
        The seat map for this concert isn’t ready yet.
      </p>
    );
  }

  const toggleSeat = (seat: Seat) => {
    if (seat.status !== "available") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) {
        next.delete(seat.id);
      } else {
        if (next.size >= maxPerOrder) {
          toast.error(`Up to ${maxPerOrder} seats per order`);
          return prev;
        }
        next.add(seat.id);
      }
      return next;
    });
  };

  const submit = () => {
    if (selected.size === 0) {
      toast.error("Pick at least one seat");
      return;
    }
    createOrder.mutate({ mode: "reserved", eventId, seatIds: [...selected] });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <Legend />
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-[oklch(0.6_0.016_250)]">Zoom</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="size-7 rounded border border-[oklch(0.35_0.02_250)] text-sm font-bold"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            className="size-7 rounded border border-[oklch(0.35_0.02_250)] text-sm font-bold"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <div className="mt-2 overflow-auto rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.17_0.012_250)] p-4">
          <div
            className="mb-6 rounded bg-[oklch(0.3_0.018_250)] py-1.5 text-center text-xs tracking-widest text-[oklch(0.72_0.012_250)] uppercase"
            style={{ width: `${100 * zoom}%`, minWidth: "100%" }}
          >
            Stage
          </div>
          <div
            className="flex flex-col gap-8"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: `${100 / zoom}%`,
            }}
          >
            {data.sections.map((section) => {
              const seats = seatsBySection.get(section.id) ?? [];
              const rows = groupByRow(seats);
              const color = section.color ?? FALLBACK;
              return (
                <div key={section.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-semibold">
                      {section.name}
                    </span>
                    <span className="font-mono text-xs text-[oklch(0.82_0.14_75)]">
                      {formatCentavos(section.price)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {rows.map(([rowLabel, rowSeats]) => (
                      <div key={rowLabel} className="flex items-center gap-1.5">
                        <span className="w-6 shrink-0 text-right font-mono text-[11px] text-[oklch(0.55_0.014_250)]">
                          {rowLabel}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rowSeats.map((seat) => (
                            <SeatButton
                              key={seat.id}
                              seat={seat}
                              color={color}
                              selected={selected.has(seat.id)}
                              onToggle={() => toggleSeat(seat)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] p-6">
        <h2 className="text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_250)] uppercase">
          Your seats
        </h2>
        {selected.size === 0 ? (
          <p className="mt-3 text-sm text-[oklch(0.6_0.016_250)]">
            Tap seats on the map to select them.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {[...selected].map((id) => {
              const seat = data.seats.find((s) => s.id === id);
              if (!seat) return null;
              const price = sectionById.get(seat.sectionId)?.price ?? 0;
              return (
                <li key={id} className="flex justify-between">
                  <span>{seat.label}</span>
                  <span className="font-mono text-[oklch(0.82_0.14_75)]">
                    {formatCentavos(price)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-[oklch(0.3_0.018_250)] pt-4">
          <span className="font-semibold">Total</span>
          <span className="font-mono text-lg font-black text-[oklch(0.82_0.14_75)]">
            {formatCentavos(total)}
          </span>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={createOrder.isPending || selected.size === 0}
          className="mt-6 w-full rounded-full bg-[oklch(0.62_0.21_250)] px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_250)] disabled:opacity-50"
        >
          {createOrder.isPending ? "Reserving…" : "Reserve & pay"}
        </button>
        <p className="mt-3 text-xs text-[oklch(0.6_0.016_250)]">
          Up to {maxPerOrder} seats. We’ll hold them 30 minutes while you pay.
        </p>
      </aside>
    </div>
  );
}

function SeatButton({
  seat,
  color,
  selected,
  onToggle,
}: {
  seat: Seat;
  color: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const available = seat.status === "available";
  const title = `${seat.label}${available ? "" : ` · ${seat.status}`}`;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={!available}
      onClick={onToggle}
      style={
        selected
          ? { backgroundColor: color, borderColor: color }
          : available
            ? { borderColor: color }
            : undefined
      }
      className={`size-6 rounded-[4px] border text-[9px] font-bold transition-colors ${
        selected
          ? "text-white"
          : available
            ? "bg-transparent text-[oklch(0.72_0.012_250)] hover:bg-[oklch(0.25_0.015_250)]"
            : seat.status === "blocked"
              ? "cursor-not-allowed border-[oklch(0.3_0.018_250)] bg-[oklch(0.22_0.014_250)] text-transparent"
              : "cursor-not-allowed border-[oklch(0.3_0.018_250)] bg-[oklch(0.28_0.016_250)] text-[oklch(0.45_0.014_250)] line-through"
      }`}
    >
      {seat.number}
    </button>
  );
}

function Legend() {
  const items = [
    { label: "Available", className: "border border-[oklch(0.62_0.21_250)]" },
    {
      label: "Selected",
      className: "bg-[oklch(0.62_0.21_250)]",
    },
    {
      label: "Taken",
      className:
        "bg-[oklch(0.28_0.016_250)] border border-[oklch(0.3_0.018_250)]",
    },
    {
      label: "Blocked",
      className:
        "bg-[oklch(0.22_0.014_250)] border border-[oklch(0.3_0.018_250)]",
    },
  ];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-[oklch(0.68_0.018_250)]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`size-4 rounded-[4px] ${i.className}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Group a section's seats into ordered rows. */
function groupByRow(seats: Seat[]): [string, Seat[]][] {
  const rows = new Map<string, Seat[]>();
  for (const s of seats) {
    const arr = rows.get(s.rowLabel) ?? [];
    arr.push(s);
    rows.set(s.rowLabel, arr);
  }
  return [...rows.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([label, arr]) => [label, arr.sort((a, b) => a.number - b.number)]);
}
