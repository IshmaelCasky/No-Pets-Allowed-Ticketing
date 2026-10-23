"use client";

import { useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { DataTableColumn } from "@npa/ui/data-table";
import type { CheckinFilter } from "@npa/validators";
import { Badge } from "@npa/ui/badge";
import { Button } from "@npa/ui/button";
import { Card, CardContent } from "@npa/ui/card";
import { DataTable } from "@npa/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";
import { toast } from "@npa/ui/toast";
import { CHECKIN_FILTERS } from "@npa/validators";

import type { CheckinRow, ScanEventOption } from "../_lib/types";
import { downloadCsv } from "~/app/admin/_lib/download-csv";
import { useListParams } from "~/app/admin/_lib/use-list-params";
import { formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { EventSelect, FilterField, SearchInput } from "./filters";

const PAGE_SIZE = 25;
/** Live refresh while the tab is open (paused when the browser tab is hidden). */
const REFRESH_MS = 15_000;

const STATUS_LABEL: Record<CheckinFilter, string> = {
  all: "All",
  checked_in: "Checked in",
  not_checked_in: "Not yet",
};

function isCheckinFilter(v: string): v is CheckinFilter {
  return (CHECKIN_FILTERS as readonly string[]).includes(v);
}

export function CheckinsTab({
  events,
  defaultEventId,
}: {
  events: ScanEventOption[];
  defaultEventId: string | undefined;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { get, page, setParams, setPage } = useListParams();
  const [exporting, setExporting] = useState(false);

  const eventParam = get("event");
  const eventId = events.some((e) => e.id === eventParam)
    ? eventParam
    : (defaultEventId ?? "");
  const statusParam = get("status");
  const status: CheckinFilter = isCheckinFilter(statusParam)
    ? statusParam
    : "all";
  const search = get("q");

  const input = {
    eventId,
    status,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, isFetching } = useQuery(
    trpc.scan.checkins.queryOptions(input, {
      enabled: !!eventId,
      refetchInterval: REFRESH_MS,
      placeholderData: keepPreviousData,
    }),
  );

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await qc.fetchQuery({
        ...trpc.scan.exportCheckinsCsv.queryOptions(input),
        staleTime: 0,
      });
      const slug =
        events
          .find((e) => e.id === eventId)
          ?.title.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") ?? "concert";
      downloadCsv(`check-ins-${slug}.csv`, csv);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No published concerts yet — check-ins appear here once a concert is
        published.
      </p>
    );
  }

  const checkedIn = data?.checkedIn ?? 0;
  const totalTickets = data?.totalTickets ?? 0;
  const pct = totalTickets > 0 ? (checkedIn / totalTickets) * 100 : 0;

  const columns: DataTableColumn<CheckinRow>[] = [
    {
      id: "holder",
      header: "Holder",
      cell: (r) => (
        <span className="font-medium whitespace-nowrap">
          {r.holderName ?? r.buyerName ?? "—"}
        </span>
      ),
    },
    {
      id: "buyer",
      header: "Buyer",
      cell: (r) => (
        <div className="flex flex-col whitespace-nowrap">
          <span>{r.buyerName ?? "—"}</span>
          {r.buyerEmail && (
            <span className="text-muted-foreground text-xs">
              {r.buyerEmail}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "order",
      header: "Order",
      cell: (r) => (
        <span className="font-mono text-xs whitespace-nowrap">
          {r.orderCode}
        </span>
      ),
    },
    {
      id: "ticket",
      header: "Ticket",
      cell: (r) => (
        <span className="whitespace-nowrap">
          {r.seatLabel ?? r.tierName ?? "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.status === "used" ? (
          <Badge variant="success">Checked in</Badge>
        ) : (
          <Badge variant="outline">Not yet</Badge>
        ),
    },
    {
      id: "usedAt",
      header: "Checked in at",
      cell: (r) => (
        <span className="whitespace-nowrap">
          {r.usedAt ? formatManila(r.usedAt) : "—"}
        </span>
      ),
    },
    {
      id: "usedBy",
      header: "By",
      cell: (r) => (
        <span className="whitespace-nowrap">{r.usedByName ?? "—"}</span>
      ),
    },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-end gap-3">
      <FilterField label="Status" className="flex flex-col gap-1">
        <Select
          value={status}
          onValueChange={(v) =>
            setParams({ status: v === "all" ? undefined : v })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHECKIN_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {STATUS_LABEL[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField
        label="Search"
        className="flex w-full flex-col gap-1 sm:w-auto"
      >
        <SearchInput
          value={search}
          onChange={(q) => setParams({ q })}
          placeholder="Holder, buyer, email, order, seat"
        />
      </FilterField>
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={exporting || !eventId}
      >
        {exporting ? "Exporting…" : "Export CSV"}
      </Button>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FilterField label="Concert" className="flex flex-col gap-1">
        <EventSelect
          events={events}
          value={eventId}
          onChange={(id) => setParams({ event: id })}
        />
      </FilterField>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-muted-foreground text-sm">Checked in</p>
            <p className="text-muted-foreground text-xs">
              {isFetching ? "Refreshing…" : "Live · updates every 15 s"}
            </p>
          </div>
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            {checkedIn.toLocaleString("en-PH")}
            <span className="text-muted-foreground text-2xl font-semibold">
              {" "}
              / {totalTickets.toLocaleString("en-PH")}
            </span>
          </p>
          <div
            className="bg-muted h-3 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Check-in progress"
            aria-valuemin={0}
            aria-valuemax={totalTickets}
            aria-valuenow={checkedIn}
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 dark:bg-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {pct.toFixed(1)}% arrived ·{" "}
            {(totalTickets - checkedIn).toLocaleString("en-PH")} still to come
          </p>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.ticketId}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading && !!eventId}
        emptyMessage={
          eventId
            ? "No tickets match these filters."
            : "Pick a concert to see check-ins."
        }
        toolbar={toolbar}
      />
    </div>
  );
}
