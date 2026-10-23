"use client";

import type { IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Scanner } from "@yudiel/react-qr-scanner";

import type { RouterOutputs } from "@npa/api";
import { Badge } from "@npa/ui/badge";
import { Button } from "@npa/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@npa/ui/card";
import { Input } from "@npa/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@npa/ui/table";
import { toast } from "@npa/ui/toast";

import { ScanResultBadge } from "~/app/admin/_components/status-badge";
import { formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";

type ScanResponse = RouterOutputs["scan"]["scan"];

/** How long (ms) to ignore a repeat of the same rawValue. */
const DUP_WINDOW_MS = 3000;
/** How long (ms) the result overlay stays up before auto-dismissing. */
const OVERLAY_MS = 2500;

/** Play a short success/error beep via the Web Audio API (no asset files). */
function beep(kind: "ok" | "err") {
  if (typeof window === "undefined") return;
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (kind === "ok") {
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else {
      osc.type = "square";
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
    osc.onended = () => void ctx.close();
  } catch {
    // Audio is best-effort; ignore failures (e.g. autoplay policy).
  }
}

export function ScannerClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [eventId, setEventId] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [overlay, setOverlay] = useState<ScanResponse | null>(null);

  // Debounce repeat scans of the same value.
  const lastScan = useRef<{ value: string; at: number } | null>(null);

  const eventsQuery = useQuery(
    trpc.event.list.queryOptions({ page: 1, pageSize: 100 }),
  );

  const countQuery = useQuery(
    trpc.scan.checkInCount.queryOptions(
      { eventId },
      { enabled: !!eventId, refetchInterval: 5000 },
    ),
  );

  const historyQuery = useQuery(
    trpc.scan.history.queryOptions(
      { eventId, page: 1, pageSize: 20 },
      { enabled: !!eventId },
    ),
  );

  // Seat map → seatId → label, for showing the seat on valid reserved scans.
  const seatMapQuery = useQuery(
    trpc.seatMap.forEvent.queryOptions({ eventId }, { enabled: !!eventId }),
  );
  const seatLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seatMapQuery.data?.seats ?? []) map.set(s.id, s.label);
    return map;
  }, [seatMapQuery.data]);

  const showResult = useCallback(
    (res: ScanResponse) => {
      beep(res.result === "valid" ? "ok" : "err");
      setOverlay(res);
      void queryClient.invalidateQueries(
        trpc.scan.history.queryFilter({ eventId, page: 1, pageSize: 20 }),
      );
      void queryClient.invalidateQueries(
        trpc.scan.checkInCount.queryFilter({ eventId }),
      );
    },
    [eventId, queryClient, trpc],
  );

  const scanMutation = useMutation(
    trpc.scan.scan.mutationOptions({
      onSuccess: (res) => showResult(res),
      onError: (err) => toast.error(err.message),
    }),
  );

  // Auto-dismiss the result overlay after it appears.
  useEffect(() => {
    if (!overlay) return;
    const timer = setTimeout(() => setOverlay(null), OVERLAY_MS);
    return () => clearTimeout(timer);
  }, [overlay]);

  const submit = useCallback(
    (rawValue: string) => {
      const value = rawValue.trim();
      if (!value || !eventId || scanMutation.isPending) return;
      const now = Date.now();
      const prev = lastScan.current;
      if (prev?.value === value && now - prev.at < DUP_WINDOW_MS) {
        return;
      }
      lastScan.current = { value, at: now };
      scanMutation.mutate({
        eventId,
        rawValue: value,
        device:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
    },
    [eventId, scanMutation],
  );

  const onScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      const value = codes[0]?.rawValue;
      if (value) submit(value);
    },
    [submit],
  );

  const events = eventsQuery.data?.items ?? [];
  const count = countQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Concert</span>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a concert to scan" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {eventId && (
          <Card className="min-w-48 py-4">
            <CardContent className="px-4">
              <CardDescription>Checked in</CardDescription>
              <CardTitle className="text-2xl">
                {count ? `${count.checkedIn} / ${count.total}` : "—"}
              </CardTitle>
            </CardContent>
          </Card>
        )}
      </div>

      {!eventId ? (
        <p className="text-muted-foreground text-sm">
          Pick a concert to start scanning.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-lg border">
              <Scanner
                onScan={onScan}
                onError={() => {
                  /* surfaced to the user by the library overlay */
                }}
                constraints={{ facingMode: "environment" }}
                sound={false}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium">Manual code entry</span>
                <Input
                  value={manualCode}
                  placeholder="Paste or type a ticket code"
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && manualCode.trim()) {
                      submit(manualCode);
                      setManualCode("");
                    }
                  }}
                />
              </div>
              <Button
                disabled={!manualCode.trim() || scanMutation.isPending}
                onClick={() => {
                  submit(manualCode);
                  setManualCode("");
                }}
              >
                Check
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Scan history</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Result</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(historyQuery.data?.items.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-muted-foreground h-16 text-center"
                      >
                        No scans yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyQuery.data?.items.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <ScanResultBadge result={log.result} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.rawValuePreview ? (
                            <>
                              {log.rawValuePreview.slice(0, 12)}
                              {log.rawValuePreview.length > 12 ? "…" : ""}
                            </>
                          ) : (
                            <span className="text-muted-foreground font-sans">
                              Ticket
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatManila(log.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {overlay && (
        <ResultOverlay
          res={overlay}
          seatLabel={
            overlay.ticket?.seatId
              ? (seatLabels.get(overlay.ticket.seatId) ?? null)
              : null
          }
          onDismiss={() => setOverlay(null)}
        />
      )}
    </div>
  );
}

function ResultOverlay({
  res,
  seatLabel,
  onDismiss,
}: {
  res: ScanResponse;
  seatLabel: string | null;
  onDismiss: () => void;
}) {
  const ok = res.result === "valid";
  const holder = res.ticket?.holderName;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDismiss();
      }}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-4 text-center text-white ${
        ok ? "bg-emerald-600" : "bg-red-600"
      }`}
    >
      <p className="text-6xl font-black tracking-tight uppercase">
        {ok ? "Valid" : res.result.replace(/_/g, " ")}
      </p>

      {seatLabel && <p className="text-3xl font-semibold">{seatLabel}</p>}
      {!seatLabel && holder && (
        <p className="text-3xl font-semibold">{holder}</p>
      )}

      {res.result === "already_used" && (
        <p className="text-lg">
          Used at {formatManila(res.usedAt)}
          {res.usedByName ? ` by ${res.usedByName}` : ""}
        </p>
      )}

      <Badge variant="outline" className="border-white/60 text-white">
        tap to dismiss
      </Badge>
    </div>
  );
}
