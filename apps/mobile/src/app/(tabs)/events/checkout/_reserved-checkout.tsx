import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { Button, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { formatCentavos } from "~/utils/format";

type Event = RouterOutputs["event"]["bySlug"];
type Seat = RouterOutputs["seatMap"]["forEvent"]["seats"][number];
type Section = RouterOutputs["seatMap"]["forEvent"]["sections"][number];

const CELL = 34;
const GAP = 4;
const PAD = 12;

const SEAT_COLOR: Record<string, string> = {
  available: "#22c55e",
  held: "#eab308",
  sold: "#6b7280",
  blocked: "#374151",
};

function SectionGrid({
  section,
  seats,
  selected,
  onToggle,
}: {
  section: Section;
  seats: Seat[];
  selected: Set<string>;
  onToggle: (seat: Seat) => void;
}) {
  // Group seats by row label, preserving the section's seat ordering.
  const rows = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const s of seats) {
      const arr = map.get(s.rowLabel) ?? [];
      arr.push(s);
      map.set(s.rowLabel, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.number - b.number);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const width = PAD * 2 + 28 + section.seatsPerRow * (CELL + GAP);
  const height = PAD * 2 + 24 + rows.length * (CELL + GAP);

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <View
          style={{ backgroundColor: section.color ?? "#c03484" }}
          className="h-3 w-3 rounded-full"
        />
        <Text className="text-foreground font-semibold">
          {section.name} · {formatCentavos(section.price)}
        </Text>
      </View>
      <Svg width={width} height={height}>
        {rows.map(([rowLabel], ri) => (
          <SvgText
            key={`lbl-${rowLabel}`}
            x={PAD}
            y={PAD + 24 + ri * (CELL + GAP) + CELL / 2 + 4}
            fontSize={12}
            fill="#9ca3af"
          >
            {rowLabel}
          </SvgText>
        ))}
        {rows.map(([, rowSeats], ri) =>
          rowSeats.map((seat, ci) => {
            const isSelected = selected.has(seat.id);
            const fill = isSelected ? "#c03484" : SEAT_COLOR[seat.status];
            const disabled = seat.status !== "available";
            return (
              <Rect
                key={seat.id}
                x={PAD + 28 + ci * (CELL + GAP)}
                y={PAD + 24 + ri * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={6}
                fill={fill}
                opacity={disabled && !isSelected ? 0.5 : 1}
                onPress={disabled ? undefined : () => onToggle(seat)}
              />
            );
          }),
        )}
      </Svg>
    </View>
  );
}

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "Available", color: "#22c55e" },
    { label: "Selected", color: "#c03484" },
    { label: "Taken", color: "#eab308" },
    { label: "Sold", color: "#6b7280" },
  ];
  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map((i) => (
        <View key={i.label} className="flex-row items-center gap-1">
          <View
            style={{ backgroundColor: i.color }}
            className="h-3 w-3 rounded"
          />
          <Text className="text-muted-foreground text-xs">{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReservedCheckout({ event }: { event: NonNullable<Event> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const mapOptions = trpc.seatMap.forEvent.queryOptions({ eventId: event.id });
  const mapQ = useQuery({
    ...mapOptions,
    refetchInterval: 10_000, // live seat-status refresh (~10s)
  });

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(3, Math.max(0.5, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });
  const composed = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const createOrder = useMutation(
    trpc.order.create.mutationOptions({
      onSuccess: (order) => {
        router.replace(`/(tabs)/events/pay/${order.code}`);
      },
      onError: (e) => {
        // CONFLICT: some seats were just taken → refresh + drop them.
        const taken = (e.data as { takenSeatIds?: string[] } | undefined)
          ?.takenSeatIds;
        if (taken?.length) {
          setSelected((prev) => {
            const next = new Set(prev);
            for (const id of taken) next.delete(id);
            return next;
          });
        }
        setError(e.message);
        void queryClient.invalidateQueries(mapOptions.queryKey as never);
      },
    }),
  );

  const toggle = useCallback(
    (seat: Seat) => {
      setError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(seat.id)) {
          next.delete(seat.id);
        } else {
          if (next.size >= event.maxPerOrder) return prev;
          next.add(seat.id);
        }
        return next;
      });
    },
    [event.maxPerOrder],
  );

  const seatsBySection = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const s of mapQ.data?.seats ?? []) {
      const arr = map.get(s.sectionId) ?? [];
      arr.push(s);
      map.set(s.sectionId, arr);
    }
    return map;
  }, [mapQ.data]);

  const total = useMemo(() => {
    const priceBySection = new Map(
      (mapQ.data?.sections ?? []).map((s) => [s.id, s.price]),
    );
    let sum = 0;
    for (const s of mapQ.data?.seats ?? []) {
      if (selected.has(s.id)) sum += priceBySection.get(s.sectionId) ?? 0;
    }
    return sum;
  }, [selected, mapQ.data]);

  if (mapQ.isLoading) return <Loading label="Loading seat map…" />;

  const selectedLabels = (mapQ.data?.seats ?? [])
    .filter((s) => selected.has(s.id))
    .map((s) => s.label);

  const submit = () => {
    setError(null);
    if (selected.size === 0) {
      setError("Pick at least one seat");
      return;
    }
    createOrder.mutate({
      mode: "reserved",
      eventId: event.id,
      seatIds: [...selected],
    });
  };

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="p-4 gap-3">
        <Text className="text-muted-foreground text-sm">
          Pinch to zoom, two-finger drag to pan. Up to {event.maxPerOrder}{" "}
          seats.
        </Text>
        <Legend />
        <View className="bg-secondary items-center rounded py-1">
          <Text className="text-muted-foreground text-xs">STAGE</Text>
        </View>

        <GestureDetector gesture={composed}>
          <Animated.View style={animatedStyle} className="gap-6">
            {mapQ.data?.sections.map((section) => (
              <SectionGrid
                key={section.id}
                section={section}
                seats={seatsBySection.get(section.id) ?? []}
                selected={selected}
                onToggle={toggle}
              />
            ))}
          </Animated.View>
        </GestureDetector>
      </ScrollView>

      <View className="border-border bg-card gap-2 border-t p-4">
        {error ? (
          <Text className="text-destructive text-sm">{error}</Text>
        ) : null}
        {selectedLabels.length ? (
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {selectedLabels.join(", ")}
          </Text>
        ) : null}
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground font-semibold">
            {selected.size} seat(s) · {formatCentavos(total)}
          </Text>
        </View>
        <Button
          label="Reserve seats"
          onPress={submit}
          loading={createOrder.isPending}
          disabled={selected.size === 0}
        />
      </View>
    </View>
  );
}
