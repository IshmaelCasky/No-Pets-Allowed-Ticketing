import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { formatManila } from "~/utils/format";

type Json = unknown;
type Change = "added" | "removed" | "changed" | "same";

interface DiffRow {
  key: string;
  before: Json;
  after: Json;
  change: Change;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

/** Render one JSON value compactly; ISO timestamps shown in Manila time. */
function show(v: Json): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (v instanceof Date) return formatManila(v);
  if (typeof v === "string") return ISO_DATE.test(v) ? formatManila(v) : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function same(a: Json, b: Json): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Key-by-key comparison of two audit snapshots (either side may be null). */
export function diffSnapshots(before: Json, after: Json): DiffRow[] | null {
  const b = before ?? undefined;
  const a = after ?? undefined;
  if ((b !== undefined && !isRecord(b)) || (a !== undefined && !isRecord(a))) {
    return null; // not objects — caller shows raw values
  }
  const keys = new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]);
  const rows: DiffRow[] = [...keys].map((key) => {
    const inB = b !== undefined && key in b;
    const inA = a !== undefined && key in a;
    const bv = inB ? b[key] : undefined;
    const av = inA ? a[key] : undefined;
    let change: Change = "same";
    // A create (no before) / delete (no after) lists every field as added/removed.
    if (!inB && inA) change = "added";
    else if (inB && !inA) change = "removed";
    else if (!same(bv, av)) change = "changed";
    return { key, before: bv, after: av, change };
  });
  const order: Record<Change, number> = {
    changed: 0,
    added: 1,
    removed: 2,
    same: 3,
  };
  return rows.sort(
    (x, y) => order[x.change] - order[y.change] || x.key.localeCompare(y.key),
  );
}

const CHANGE_STYLE: Record<
  Change,
  { box: string; tag: string; label: string }
> = {
  changed: {
    box: "border-amber-500/50 bg-amber-500/10",
    tag: "text-amber-600",
    label: "changed",
  },
  added: {
    box: "border-green-500/50 bg-green-500/10",
    tag: "text-green-600",
    label: "added",
  },
  removed: {
    box: "border-red-500/50 bg-red-500/10",
    tag: "text-red-600",
    label: "removed",
  },
  same: {
    box: "border-border bg-card",
    tag: "text-muted-foreground",
    label: "",
  },
};

function DiffItem({ row }: { row: DiffRow }) {
  const s = CHANGE_STYLE[row.change];
  return (
    <View className={`gap-1 rounded-lg border p-3 ${s.box}`}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-foreground flex-1 font-mono text-sm font-bold">
          {row.key}
        </Text>
        {s.label ? (
          <Text className={`text-xs font-semibold uppercase ${s.tag}`}>
            {s.label}
          </Text>
        ) : null}
      </View>
      {row.change === "changed" ? (
        <>
          <Text className="text-sm text-red-600 line-through" selectable>
            {show(row.before)}
          </Text>
          <Text className="text-sm text-green-600" selectable>
            {show(row.after)}
          </Text>
        </>
      ) : (
        <Text className="text-foreground text-sm" selectable>
          {show(row.change === "removed" ? row.before : row.after)}
        </Text>
      )}
    </View>
  );
}

/** Changed keys highlighted first; unchanged keys behind a toggle. */
export function JsonDiff({ before, after }: { before: Json; after: Json }) {
  const [showSame, setShowSame] = useState(false);
  const rows = diffSnapshots(before, after);

  if (before == null && after == null) {
    return (
      <Text className="text-muted-foreground text-sm">
        No before/after data recorded for this entry.
      </Text>
    );
  }
  if (!rows) {
    return (
      <View className="gap-2">
        <DiffItem
          row={{
            key: "value",
            before,
            after,
            change: same(before, after) ? "same" : "changed",
          }}
        />
      </View>
    );
  }

  const changed = rows.filter((r) => r.change !== "same");
  const unchanged = rows.filter((r) => r.change === "same");
  return (
    <View className="gap-2">
      {changed.length === 0 ? (
        <Text className="text-muted-foreground text-sm">No field changed.</Text>
      ) : (
        changed.map((r) => <DiffItem key={r.key} row={r} />)
      )}
      {unchanged.length > 0 ? (
        <>
          <Pressable onPress={() => setShowSame((v) => !v)} hitSlop={8}>
            <Text className="text-primary py-1 text-sm font-semibold">
              {showSame ? "Hide" : "Show"} {unchanged.length} unchanged field
              {unchanged.length === 1 ? "" : "s"}
            </Text>
          </Pressable>
          {showSame
            ? unchanged.map((r) => <DiffItem key={r.key} row={r} />)
            : null}
        </>
      ) : null}
    </View>
  );
}

/** Collapsible raw JSON block (monospace, scrolls sideways, selectable). */
export function JsonBlock({ label, value }: { label: string; value: Json }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="border-border bg-card overflow-hidden rounded-xl border">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between p-3 active:opacity-70"
      >
        <Text className="text-foreground text-sm font-semibold">
          {label} JSON
        </Text>
        <Text className="text-muted-foreground">{open ? "⌃" : "⌄"}</Text>
      </Pressable>
      {open ? (
        <ScrollView horizontal className="bg-muted border-border border-t">
          <Text selectable className="text-foreground p-3 font-mono text-xs">
            {value == null ? "—" : JSON.stringify(value, null, 2)}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}
