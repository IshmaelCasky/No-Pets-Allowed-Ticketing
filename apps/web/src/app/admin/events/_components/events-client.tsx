"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "@npa/api";
import type { DataTableColumn } from "@npa/ui/data-table";
import { Button } from "@npa/ui/button";
import { DataTable } from "@npa/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@npa/ui/dialog";
import { Input } from "@npa/ui/input";
import { toast } from "@npa/ui/toast";

import { formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { EventStatusBadge } from "../../_components/status-badge";
import { useListParams } from "../../_lib/use-list-params";
import { EventForm } from "./event-form";

type Event = RouterOutputs["event"]["list"]["items"][number];

export function EventsClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { get, page, setParams, setPage } = useListParams();
  const search = get("search");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery(
    trpc.event.list.queryOptions({
      page,
      pageSize: 20,
      search: search || undefined,
    }),
  );

  const create = useMutation(
    trpc.event.create.mutationOptions({
      onSuccess: () => {
        toast.success("Event created");
        setCreateOpen(false);
        void queryClient.invalidateQueries(trpc.event.list.queryFilter());
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const columns: DataTableColumn<Event>[] = [
    {
      id: "title",
      header: "Title",
      cell: (r) => (
        <Link
          href={`/admin/events/${r.id}`}
          className="font-medium hover:underline"
        >
          {r.title}
        </Link>
      ),
    },
    { id: "venue", header: "Venue", cell: (r) => r.venue ?? "—" },
    {
      id: "mode",
      header: "Mode",
      cell: (r) => (r.seatingMode === "ga" ? "GA" : "Reserved"),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => <EventStatusBadge status={r.status} />,
    },
    {
      id: "starts",
      header: "Starts",
      cell: (r) => formatManila(r.startsAt),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data?.items ?? []}
      rowKey={(r) => r.id}
      total={data?.total ?? 0}
      page={page}
      pageSize={20}
      onPageChange={setPage}
      isLoading={isLoading}
      emptyMessage="No events yet."
      toolbar={
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search title or slug…"
            defaultValue={search}
            onChange={(e) => setParams({ search: e.target.value })}
            className="max-w-sm"
          />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>New event</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create event</DialogTitle>
              </DialogHeader>
              <EventForm
                isPending={create.isPending}
                onSubmit={(values) => create.mutate(values)}
              />
            </DialogContent>
          </Dialog>
        </div>
      }
    />
  );
}
