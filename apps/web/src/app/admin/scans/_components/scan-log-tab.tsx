"use client";

import { useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { DataTableColumn } from "@npa/ui/data-table";
import type { ScanResult } from "@npa/validators";
import { Button } from "@npa/ui/button";
import { DataTable } from "@npa/ui/data-table";
import { Input } from "@npa/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";
import { toast } from "@npa/ui/toast";
import { SCAN_RESULTS } from "@npa/validators";

import type { ScanEventOption, ScanLogRow } from "../_lib/types";
import { ScanResultBadge } from "~/app/admin/_components/status-badge";
import { downloadCsv } from "~/app/admin/_lib/download-csv";
import { useListParams } from "~/app/admin/_lib/use-list-params";
import { formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { manilaDayEnd, manilaDayStart } from "../_lib/types";
import { ALL, EventSelect, FilterField, SearchInput } from "./filters";

const PAGE_SIZE = 25;

const RESULT_LABEL: Record<ScanResult, string> = {
  valid: "Valid",
  already_used: "Already used",
  wrong_event: "Wrong concert",
  void: "Void",
  not_found: "Not found",
};

function isScanResult(v: string): v is ScanResult {
  return (SCAN_RESULTS as readonly string[]).includes(v);
}

export function ScanLogTab({ events }: { events: ScanEventOption[] }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { get, page, setParams, setPage } = useListParams();
  const [exporting, setExporting] = useState(false);
  // Bumped by "Clear" to remount the search box (drops its local text).
  const [searchKey, setSearchKey] = useState(0);

  const eventParam = get("logEvent");
  const eventId = events.some((e) => e.id === eventParam)
    ? eventParam
    : undefined;
  const resultParam = get("result");
  const result = isScanResult(resultParam) ? resultParam : undefined;
  const scannedById = get("staff") || undefined;
  const from = get("from");
  const to = get("to");
  const search = get("logQ");

  const input = {
    eventId,
    result,
    scannedById,
    dateFrom: manilaDayStart(from),
    dateTo: manilaDayEnd(to),
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading } = useQuery(
    trpc.scan.logs.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const { data: scanners } = useQuery(
    trpc.scan.scannerOptions.queryOptions({ eventId }),
  );

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await qc.fetchQuery({
        ...trpc.scan.exportLogsCsv.queryOptions(input),
        staleTime: 0,
      });
      downloadCsv("scan-log.csv", csv);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const columns: DataTableColumn<ScanLogRow>[] = [
    {
      id: "when",
      header: "When",
      cell: (r) => (
        <span className="whitespace-nowrap">{formatManila(r.createdAt)}</span>
      ),
    },
    {
      id: "result",
      header: "Result",
      cell: (r) => <ScanResultBadge result={r.result} />,
    },
    {
      id: "event",
      header: "Concert",
      cell: (r) => (
        <span className="whitespace-nowrap">{r.eventTitle ?? "—"}</span>
      ),
    },
    {
      id: "holder",
      header: "Holder / Order",
      cell: (r) =>
        r.ticketId ? (
          <div className="flex flex-col whitespace-nowrap">
            <span>{r.holderName ?? r.buyerName ?? "—"}</span>
            {r.orderCode && (
              <span className="text-muted-foreground font-mono text-xs">
                {r.orderCode}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">Unknown code</span>
            {r.rawValuePreview && (
              <span
                className="text-muted-foreground max-w-56 truncate font-mono text-xs"
                title={r.rawValuePreview}
              >
                {r.rawValuePreview}
              </span>
            )}
          </div>
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
      id: "by",
      header: "Scanned by",
      cell: (r) => (
        <span className="whitespace-nowrap">{r.scannedByName ?? "—"}</span>
      ),
    },
    {
      id: "device",
      header: "Device",
      cell: (r) => (
        <span
          className="text-muted-foreground block max-w-48 truncate text-xs"
          title={r.device ?? undefined}
        >
          {r.device ?? "—"}
        </span>
      ),
    },
  ];

  const hasFilters = [eventId, result, scannedById, from, to, search].some(
    Boolean,
  );

  const toolbar = (
    <div className="flex flex-wrap items-end gap-3">
      <FilterField
        label="Concert"
        className="flex w-full flex-col gap-1 sm:w-auto"
      >
        <EventSelect
          events={events}
          value={eventId ?? ""}
          onChange={(id) =>
            // Staff list depends on the concert; drop a stale staff filter.
            setParams({ logEvent: id, staff: undefined })
          }
          allowAll
        />
      </FilterField>
      <FilterField label="Result" className="flex flex-col gap-1">
        <Select
          value={result ?? ALL}
          onValueChange={(v) => setParams({ result: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All results</SelectItem>
            {SCAN_RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {RESULT_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Staff" className="flex flex-col gap-1">
        <Select
          value={scannedById ?? ALL}
          onValueChange={(v) => setParams({ staff: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All staff</SelectItem>
            {scanners?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="From" className="flex flex-col gap-1">
        <Input
          type="date"
          className="w-40"
          value={from}
          max={to || undefined}
          onChange={(e) => setParams({ from: e.target.value })}
        />
      </FilterField>
      <FilterField label="To" className="flex flex-col gap-1">
        <Input
          type="date"
          className="w-40"
          value={to}
          min={from || undefined}
          onChange={(e) => setParams({ to: e.target.value })}
        />
      </FilterField>
      <FilterField
        label="Search"
        className="flex w-full flex-col gap-1 sm:w-auto"
      >
        <SearchInput
          key={searchKey}
          value={search}
          onChange={(q) => setParams({ logQ: q })}
          placeholder="Holder, buyer, email, order, seat"
        />
      </FilterField>
      <div className="flex gap-2">
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchKey((k) => k + 1);
              setParams({
                logEvent: undefined,
                result: undefined,
                staff: undefined,
                from: undefined,
                to: undefined,
                logQ: undefined,
              });
            }}
          >
            Clear
          </Button>
        )}
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.id}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No scans match these filters."
        toolbar={toolbar}
      />
    </div>
  );
}
