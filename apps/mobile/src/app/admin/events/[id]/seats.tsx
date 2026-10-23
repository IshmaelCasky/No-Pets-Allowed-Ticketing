import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Seat } from "~/components/events-admin/use-inventory";
import { Chips, RequirePerm } from "~/components/admin";
import {
  gridSize,
  isToggleable,
  SeatGrid,
  SeatLegend,
} from "~/components/events-admin/seat-grid";
import {
  seatCounts,
  useConcertInventory,
} from "~/components/events-admin/use-inventory";
import { Button, Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { showError } from "~/utils/feedback";
import { formatCentavos } from "~/utils/format";
import { usePermissions } from "~/utils/use-permissions";

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Pinch-zoom / drag-pan viewport around a fixed-size child. */
function ZoomPan({
  contentWidth,
  contentHeight,
  resetKey,
  children,
}: {
  contentWidth: number;
  contentHeight: number;
  /** Change to re-fit (e.g. when switching sections). */
  resetKey: string;
  children: ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const fit =
    box.w > 0 && box.h > 0
      ? Math.max(
          MIN_SCALE,
          Math.min(
            1,
            (box.w - 16) / contentWidth,
            (box.h - 16) / contentHeight,
          ),
        )
      : 1;

  const reset = useCallback(() => {
    scale.value = fit;
    savedScale.value = fit;
    tx.value = 0;
    ty.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  }, [fit, scale, savedScale, tx, ty, savedX, savedY]);

  useEffect(() => {
    reset();
  }, [reset, resetKey]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, savedScale.value * e.scale),
      );
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .minDistance(8)
    .onUpdate((e) => {
      tx.value = savedX.value + e.translationX;
      ty.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = tx.value;
      savedY.value = ty.value;
    });
  const gesture = Gesture.Simultaneous(pinch, pan);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View
      className="bg-muted/40 flex-1 overflow-hidden"
      onLayout={(e) =>
        setBox({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      <GestureDetector gesture={gesture}>
        <View className="flex-1">
          <Animated.View
            style={[
              {
                position: "absolute",
                width: contentWidth,
                height: contentHeight,
                left: (box.w - contentWidth) / 2,
                top: (box.h - contentHeight) / 2,
              },
              style,
            ]}
          >
            {children}
          </Animated.View>
        </View>
      </GestureDetector>
      <Pressable
        onPress={reset}
        className="border-border bg-card absolute top-2 right-2 rounded-full border px-3 py-1.5"
      >
        <Text className="text-foreground text-xs font-semibold">Fit</Text>
      </Pressable>
    </View>
  );
}

function SeatsEditor({
  id,
  initialSectionId,
}: {
  id: string;
  initialSectionId?: string;
}) {
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canWrite = has("events:write");
  const { mapQ, sections, seatsBySection } = useConcertInventory(id);
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const section =
    sections.find((s) => s.id === sectionId) ?? sections[0] ?? undefined;
  const seats = useMemo(
    () => (section ? (seatsBySection.get(section.id) ?? []) : []),
    [section, seatsBySection],
  );

  // Live refresh may have changed statuses: act only on still-toggleable seats.
  const picked = useMemo(
    () => seats.filter((s) => selected.has(s.id) && isToggleable(s)),
    [seats, selected],
  );
  const toBlock = picked.filter((s) => s.status === "available");
  const toUnblock = picked.filter((s) => s.status === "blocked");

  const setBlocked = useMutation(
    trpc.seatMap.setSeatsBlocked.mutationOptions({
      onSuccess: (_rows, vars) => {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const sid of vars.seatIds) next.delete(sid);
          return next;
        });
      },
      onError: (e) => showError(e),
      onSettled: () =>
        queryClient.invalidateQueries(
          trpc.seatMap.forEvent.queryFilter({ eventId: id }),
        ),
    }),
  );

  const toggle = useCallback((seat: Seat) => {
    void Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else next.add(seat.id);
      return next;
    });
  }, []);

  const switchSection = (next: string | undefined) => {
    if (!next) return;
    setSectionId(next);
    setSelected(new Set());
  };

  if (mapQ.isLoading) return <Loading label="Loading seat map…" />;
  if (!section) return <Empty title="No sections yet" />;

  const counts = seatCounts(seats);
  const { width, height } = gridSize(section.rows, section.seatsPerRow);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: section.name }} />
      <View className="gap-2 px-4 pt-3 pb-2">
        {sections.length > 1 ? (
          <Chips
            options={sections.map((s) => ({ value: s.id, label: s.name }))}
            value={section.id}
            onChange={switchSection}
          />
        ) : null}
        <Text className="text-muted-foreground text-xs">
          {formatCentavos(section.price)} · {section.rows} ×{" "}
          {section.seatsPerRow} · Pinch to zoom, drag to move.
          {canWrite ? " Tap available or blocked seats to select." : ""}
        </Text>
        <SeatLegend counts={counts} showSelected={canWrite} />
      </View>

      <View className="bg-secondary mx-4 items-center rounded py-1">
        <Text className="text-muted-foreground text-xs tracking-widest">
          STAGE
        </Text>
      </View>

      <ZoomPan
        contentWidth={width}
        contentHeight={height}
        resetKey={section.id}
      >
        <SeatGrid
          seats={seats}
          seatsPerRow={section.seatsPerRow}
          selected={canWrite ? selected : EMPTY_SET}
          onToggle={canWrite ? toggle : undefined}
        />
      </ZoomPan>

      {canWrite ? (
        <View className="border-border bg-card gap-2 border-t p-4">
          {picked.length === 0 ? (
            <Text className="text-muted-foreground text-center text-sm">
              Select seats to block (pillars, production, comps) or unblock.
              Held and sold seats can't be changed.
            </Text>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground font-semibold">
                  {picked.length} selected
                </Text>
                <Pressable onPress={() => setSelected(new Set())} hitSlop={8}>
                  <Text className="text-primary text-sm font-semibold">
                    Clear
                  </Text>
                </Pressable>
              </View>
              <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                {picked.map((s) => s.label).join(", ")}
              </Text>
              <View className="flex-row gap-2">
                {toBlock.length > 0 ? (
                  <View className="flex-1">
                    <Button
                      label={`Block ${toBlock.length}`}
                      loading={
                        setBlocked.isPending && setBlocked.variables.blocked
                      }
                      disabled={setBlocked.isPending}
                      onPress={() =>
                        setBlocked.mutate({
                          seatIds: toBlock.map((s) => s.id),
                          blocked: true,
                        })
                      }
                    />
                  </View>
                ) : null}
                {toUnblock.length > 0 ? (
                  <View className="flex-1">
                    <Button
                      label={`Unblock ${toUnblock.length}`}
                      variant="secondary"
                      loading={
                        setBlocked.isPending && !setBlocked.variables.blocked
                      }
                      disabled={setBlocked.isPending}
                      onPress={() =>
                        setBlocked.mutate({
                          seatIds: toUnblock.map((s) => s.id),
                          blocked: false,
                        })
                      }
                    />
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function SeatsScreen() {
  const { id, sectionId } = useLocalSearchParams<{
    id: string;
    sectionId?: string;
  }>();
  return (
    <RequirePerm anyOf={["events:read"]}>
      <SeatsEditor id={id} initialSectionId={sectionId} />
    </RequirePerm>
  );
}
