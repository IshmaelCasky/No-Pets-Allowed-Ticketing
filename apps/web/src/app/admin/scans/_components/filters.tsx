"use client";

import { useEffect, useState } from "react";

import { Input } from "@npa/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";

import type { ScanEventOption } from "../_lib/types";
import { formatManilaDate } from "~/lib/format";

/** Radix Select can't hold "" — this sentinel stands for "no filter". */
export const ALL = "__all__";

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "flex min-w-0 flex-col gap-1"}>
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

/** Concert picker fed by `scan.eventOptions` (gate scanners lack events:read). */
export function EventSelect({
  events,
  value,
  onChange,
  allowAll = false,
}: {
  events: ScanEventOption[];
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
}) {
  return (
    <Select
      value={value || (allowAll ? ALL : undefined)}
      onValueChange={(v) => onChange(v === ALL ? "" : v)}
    >
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue placeholder="Select a concert" />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={ALL}>All concerts</SelectItem>}
        {events.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.title} · {formatManilaDate(e.startsAt)}
            {e.status === "cancelled" ? " (cancelled)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Search box that writes to the URL after the user pauses typing (or on
 * Enter), so each keystroke doesn't trigger a query.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (text.trim() === value) return;
    const t = setTimeout(() => onChange(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text, value, onChange]);

  return (
    <Input
      type="search"
      className="w-full sm:w-64"
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onChange(text.trim());
      }}
    />
  );
}
