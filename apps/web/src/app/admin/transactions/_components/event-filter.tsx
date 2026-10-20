"use client";

import { useQuery } from "@tanstack/react-query";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";

import { useTRPC } from "~/trpc/react";

const ALL = "__all__";

/** Event picker used to scope transaction queues to a single event. */
export function EventFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (eventId: string | undefined) => void;
}) {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.event.list.queryOptions({ page: 1, pageSize: 100, sortDir: "desc" }),
  );

  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : v)}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="All events" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All events</SelectItem>
        {data?.items.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
