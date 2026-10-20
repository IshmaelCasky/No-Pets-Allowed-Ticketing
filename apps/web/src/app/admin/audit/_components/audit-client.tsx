"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "@npa/api";
import type { DataTableColumn } from "@npa/ui/data-table";
import { Badge } from "@npa/ui/badge";
import { Button } from "@npa/ui/button";
import { DataTable } from "@npa/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@npa/ui/dialog";
import { Input } from "@npa/ui/input";
import { toast } from "@npa/ui/toast";

import { downloadCsv } from "~/app/admin/_lib/download-csv";
import { useListParams } from "~/app/admin/_lib/use-list-params";
import { formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";

type AuditRow = RouterOutputs["audit"]["list"]["items"][number];

const PAGE_SIZE = 20;

export function AuditClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { get, page, setParams, setPage } = useListParams();
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = {
    action: get("action") || undefined,
    entityType: get("entityType") || undefined,
    actorId: get("actorId") || undefined,
    dateFrom: get("dateFrom") || undefined,
    dateTo: get("dateTo") || undefined,
  };

  const input = {
    page,
    pageSize: PAGE_SIZE,
    ...filters,
  };

  const { data, isLoading } = useQuery(trpc.audit.list.queryOptions(input));

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await qc.fetchQuery(trpc.audit.exportCsv.queryOptions(input));
      downloadCsv("audit-logs.csv", csv);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const columns: DataTableColumn<AuditRow>[] = [
    {
      id: "when",
      header: "When",
      cell: (r) => (
        <span className="whitespace-nowrap">{formatManila(r.createdAt)}</span>
      ),
    },
    {
      id: "actor",
      header: "Actor",
      cell: (r) => r.actorName ?? r.actorId ?? "—",
    },
    {
      id: "action",
      header: "Action",
      cell: (r) => <Badge variant="secondary">{r.action}</Badge>,
    },
    {
      id: "entity",
      header: "Entity",
      cell: (r) => (
        <span className="text-sm">
          {r.entityType}
          {r.entityId ? (
            <span className="text-muted-foreground"> · {r.entityId}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "ip",
      header: "IP",
      cell: (r) => (
        <span className="text-muted-foreground font-mono text-xs">
          {r.ip ?? "—"}
        </span>
      ),
    },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Action</label>
        <Input
          className="w-40"
          placeholder="order.approve"
          defaultValue={get("action")}
          onBlur={(e) => setParams({ action: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParams({ action: e.currentTarget.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Entity type</label>
        <Input
          className="w-36"
          placeholder="order"
          defaultValue={get("entityType")}
          onBlur={(e) => setParams({ entityType: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              setParams({ entityType: e.currentTarget.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Actor ID</label>
        <Input
          className="w-40"
          placeholder="user id"
          defaultValue={get("actorId")}
          onBlur={(e) => setParams({ actorId: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              setParams({ actorId: e.currentTarget.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">From</label>
        <Input
          type="date"
          className="w-40"
          defaultValue={get("dateFrom")}
          onChange={(e) => setParams({ dateFrom: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">To</label>
        <Input
          type="date"
          className="w-40"
          defaultValue={get("dateTo")}
          onChange={(e) => setParams({ dateTo: e.target.value })}
        />
      </div>
      <Button variant="outline" onClick={handleExport} disabled={exporting}>
        {exporting ? "Exporting…" : "Export CSV"}
      </Button>
    </div>
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.id}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No audit entries match these filters."
        onRowClick={(r) => setSelected(r)}
        toolbar={toolbar}
      />

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-3xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.action}</DialogTitle>
                <DialogDescription>
                  {selected.entityType}
                  {selected.entityId ? ` · ${selected.entityId}` : ""} ·{" "}
                  {formatManila(selected.createdAt)}
                  {selected.actorName ? ` · ${selected.actorName}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <JsonBlock label="Before" value={selected.before} />
                <JsonBlock label="After" value={selected.after} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
