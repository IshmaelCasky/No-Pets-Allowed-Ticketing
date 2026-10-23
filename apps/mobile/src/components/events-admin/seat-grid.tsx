import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

import type { SeatStatus } from "@npa/validators";
import { SEAT_STATUSES } from "@npa/validators";

import type { Seat } from "./use-inventory";
import { SEAT_COLOR, SEAT_STATUS_LABEL, SELECTED_STROKE } from "./status";

export const CELL = 28;
export const GAP = 4;
const PAD = 8;
const ROW_LABEL_W = 26;
const HEADER_H = 18;

/** Pixel size of a section grid (for fit-to-width zoom). */
export function gridSize(rows: number, seatsPerRow: number) {
  return {
    width: PAD * 2 + ROW_LABEL_W + seatsPerRow * (CELL + GAP),
    height: PAD * 2 + HEADER_H + rows * (CELL + GAP),
  };
}

/** Only available ↔ blocked can be toggled (held / sold are committed). */
export function isToggleable(seat: Seat): boolean {
  return seat.status === "available" || seat.status === "blocked";
}

/**
 * One section's seats drawn as an SVG grid, coloured by live status. Tapping
 * an available/blocked seat calls `onToggle` (selection is owned by the
 * parent); held/sold seats are dimmed and not tappable. Selected seats get a
 * blue ring so their status colour stays visible.
 */
export const SeatGrid = memo(function SeatGrid({
  seats,
  seatsPerRow,
  selected,
  onToggle,
}: {
  /** Already sorted by row then number (see `useConcertInventory`). */
  seats: readonly Seat[];
  seatsPerRow: number;
  selected: ReadonlySet<string>;
  /** Omit for a read-only map. */
  onToggle?: (seat: Seat) => void;
}) {
  const rows = useMemo(() => {
    const out: { label: string; seats: Seat[] }[] = [];
    for (const s of seats) {
      const last = out[out.length - 1];
      if (last?.label === s.rowLabel) last.seats.push(s);
      else out.push({ label: s.rowLabel, seats: [s] });
    }
    return out;
  }, [seats]);

  const { width, height } = gridSize(rows.length, seatsPerRow);
  const x0 = PAD + ROW_LABEL_W;
  const y0 = PAD + HEADER_H;

  return (
    <Svg width={width} height={height}>
      {Array.from({ length: seatsPerRow }, (_, i) => (
        <SvgText
          key={`col-${i}`}
          x={x0 + i * (CELL + GAP) + CELL / 2}
          y={PAD + 11}
          fontSize={9}
          fill="#9ca3af"
          textAnchor="middle"
        >
          {i + 1}
        </SvgText>
      ))}
      {rows.map((row, ri) => (
        <SvgText
          key={`row-${row.label}`}
          x={PAD + ROW_LABEL_W - 6}
          y={y0 + ri * (CELL + GAP) + CELL / 2 + 4}
          fontSize={11}
          fill="#9ca3af"
          textAnchor="end"
        >
          {row.label}
        </SvgText>
      ))}
      {rows.map((row, ri) =>
        row.seats.map((seat) => {
          const isSelected = selected.has(seat.id);
          const toggleable = isToggleable(seat);
          return (
            <Rect
              key={seat.id}
              x={x0 + (seat.number - 1) * (CELL + GAP)}
              y={y0 + ri * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={5}
              fill={SEAT_COLOR[seat.status]}
              opacity={toggleable ? 1 : 0.65}
              stroke={isSelected ? SELECTED_STROKE : undefined}
              strokeWidth={isSelected ? 3 : 0}
              onPress={
                onToggle && toggleable ? () => onToggle(seat) : undefined
              }
            />
          );
        }),
      )}
    </Svg>
  );
});

/** Colour legend for the seat map, optionally with counts. */
export function SeatLegend({
  counts,
  showSelected,
}: {
  counts?: Record<SeatStatus, number>;
  showSelected?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
      {SEAT_STATUSES.map((status) => (
        <View key={status} className="flex-row items-center gap-1.5">
          <View
            style={{ backgroundColor: SEAT_COLOR[status] }}
            className="h-3.5 w-3.5 rounded"
          />
          <Text className="text-muted-foreground text-xs">
            {SEAT_STATUS_LABEL[status]}
            {counts ? ` ${counts[status]}` : ""}
          </Text>
        </View>
      ))}
      {showSelected ? (
        <View className="flex-row items-center gap-1.5">
          <View
            style={{ borderColor: SELECTED_STROKE }}
            className="h-3.5 w-3.5 rounded border-2"
          />
          <Text className="text-muted-foreground text-xs">Selected</Text>
        </View>
      ) : null}
    </View>
  );
}
