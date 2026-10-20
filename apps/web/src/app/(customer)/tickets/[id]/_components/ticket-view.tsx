"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";

import { toast } from "@npa/ui/toast";

import { formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { StatusChip } from "../../../../(public)/_components/status-chip";

export function TicketView({
  ticketId,
  token,
  status,
  holderName,
  seatLabel,
  eventTitle,
  usedAt,
}: {
  ticketId: string;
  token: string;
  status: string;
  holderName: string | null;
  seatLabel: string | null;
  eventTitle: string;
  usedAt: string | null;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(holderName ?? "");
  const [fullscreen, setFullscreen] = useState(false);

  const updateHolder = useMutation(
    trpc.ticket.updateHolder.mutationOptions({
      onSuccess: () => {
        toast.success("Holder name updated");
        setEditing(false);
        router.refresh();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const active = status === "active";

  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-xl font-black tracking-tight uppercase">
            {eventTitle}
          </h1>
        </div>
        <div className="mt-1 flex items-center justify-center">
          <StatusChip kind="ticket" status={status} />
        </div>

        {/* QR — encodes ONLY the ticket token. */}
        <button
          type="button"
          onClick={() => active && setFullscreen(true)}
          className="mx-auto mt-6 block rounded-xl bg-white p-4"
          aria-label="Show full-screen QR"
        >
          <QRCodeSVG
            value={token}
            size={220}
            level="M"
            className={active ? "" : "opacity-40"}
          />
        </button>
        {active ? (
          <p className="mt-3 text-xs text-[oklch(0.6_0.016_309)]">
            Tap the code to show it full-screen at the gate.
          </p>
        ) : status === "used" ? (
          <p className="mt-3 text-xs text-[oklch(0.6_0.016_309)]">
            Checked in{usedAt ? ` ${formatManila(usedAt)}` : ""}.
          </p>
        ) : (
          <p className="mt-3 text-xs text-[oklch(0.72_0.19_25)]">
            This ticket is void.
          </p>
        )}

        {seatLabel && (
          <p className="mt-4 font-mono text-lg font-bold text-[oklch(0.82_0.14_75)]">
            {seatLabel}
          </p>
        )}
      </div>

      {/* holder name */}
      <div className="mt-5 rounded-xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-5">
        <p className="text-sm font-semibold tracking-widest text-[oklch(0.68_0.018_309)] uppercase">
          Holder name
        </p>
        {editing ? (
          <div className="mt-3 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name on this ticket"
              className="w-full rounded-lg border border-[oklch(0.3_0.018_310)] bg-[oklch(0.16_0.012_312)] px-3.5 py-2.5 text-sm text-white placeholder:text-[oklch(0.55_0.014_309)] focus-visible:border-[oklch(0.62_0.21_350)] focus-visible:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={updateHolder.isPending}
                onClick={() =>
                  updateHolder.mutate({
                    ticketId,
                    holderName: name.trim() || undefined,
                  })
                }
                className="rounded-full bg-[oklch(0.62_0.21_350)] px-5 py-2 text-sm font-bold text-white hover:bg-[oklch(0.68_0.2_349)] disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(holderName ?? "");
                  setEditing(false);
                }}
                className="rounded-full border border-[oklch(0.35_0.02_310)] px-5 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <span>{holderName ?? "—"}</span>
            {active && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm font-semibold text-[oklch(0.72_0.17_348)] hover:underline"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* full-screen QR overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6"
          onClick={() => setFullscreen(false)}
          role="dialog"
          aria-modal="true"
        >
          <QRCodeSVG value={token} size={320} level="M" />
          {seatLabel && (
            <p className="mt-6 font-mono text-2xl font-black text-black">
              {seatLabel}
            </p>
          )}
          <p className="mt-2 text-sm text-neutral-500">{eventTitle}</p>
          <button
            type="button"
            className="mt-8 rounded-full border border-neutral-300 px-6 py-2 text-sm font-semibold text-black"
          >
            Tap anywhere to close
          </button>
        </div>
      )}
    </div>
  );
}
