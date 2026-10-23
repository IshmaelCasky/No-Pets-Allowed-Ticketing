import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Seat, Section } from "./use-inventory";
import { SectionHeader } from "~/components/admin";
import { Card } from "~/components/ui";
import { trpc } from "~/utils/api";
import { confirm, showError } from "~/utils/feedback";
import { formatCentavos } from "~/utils/format";
import { SeatLegend } from "./seat-grid";
import { DEFAULT_SECTION_COLOR } from "./status";
import { SmallButton } from "./tier-panel";
import { seatCounts } from "./use-inventory";

/**
 * Reserved-seating grid builder (phone layout): section list with add / edit /
 * delete, up/down reorder (instead of web drag), live seat counts, and a
 * "Seats" button that opens the zoomable block/unblock grid.
 */
export function SectionPanel({
  eventId,
  sections,
  seatsBySection,
  canWrite,
}: {
  eventId: string;
  sections: readonly Section[];
  seatsBySection: ReadonlyMap<string, Seat[]>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries(
      trpc.seatMap.forEvent.queryFilter({ eventId }),
    );

  const reorder = useMutation(
    trpc.seatMap.reorderSections.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (e) => {
        showError(e);
        void invalidate();
      },
    }),
  );
  const remove = useMutation(
    trpc.seatMap.deleteSection.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (e) => showError(e),
    }),
  );

  const move = (index: number, dir: -1 | 1) => {
    const next = [...sections];
    const a = next[index];
    const b = next[index + dir];
    if (!a || !b) return;
    next[index] = b;
    next[index + dir] = a;
    reorder.mutate({ eventId, orderedSectionIds: next.map((s) => s.id) });
  };

  const allSeats = [...seatsBySection.values()].flat();
  const busy = reorder.isPending || remove.isPending;

  return (
    <View className="gap-3">
      <SectionHeader
        title="Seat map"
        action={
          canWrite ? (
            <Pressable
              hitSlop={8}
              onPress={() =>
                router.push({
                  pathname: "/admin/events/[id]/section",
                  params: { id: eventId },
                })
              }
            >
              <Text className="text-primary text-sm font-semibold">
                + Add section
              </Text>
            </Pressable>
          ) : null
        }
      />
      <Card>
        <SeatLegend counts={seatCounts(allSeats)} />
      </Card>

      {sections.length === 0 ? (
        <Card>
          <Text className="text-muted-foreground text-center text-sm">
            No sections yet.
            {canWrite ? " Add a section to build the seat map." : ""}
          </Text>
        </Card>
      ) : null}

      {sections.map((section, i) => {
        const seats = seatsBySection.get(section.id) ?? [];
        const c = seatCounts(seats);
        const committed = c.held + c.sold > 0;
        return (
          <Card key={section.id} className="gap-3">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  backgroundColor: section.color ?? DEFAULT_SECTION_COLOR,
                }}
                className="h-4 w-4 rounded-full"
              />
              <View className="flex-1">
                <Text
                  className="text-foreground text-base font-semibold"
                  numberOfLines={1}
                >
                  {section.name}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {formatCentavos(section.price)} · {section.rows} ×{" "}
                  {section.seatsPerRow} ({seats.length} seats)
                </Text>
              </View>
              {canWrite ? (
                <View className="flex-row gap-1">
                  <Pressable
                    accessibilityLabel="Move up"
                    disabled={i === 0 || busy}
                    onPress={() => move(i, -1)}
                    className={`border-border h-10 w-10 items-center justify-center rounded-lg border ${
                      i === 0 || busy ? "opacity-30" : ""
                    }`}
                  >
                    <Text className="text-foreground text-base">↑</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Move down"
                    disabled={i === sections.length - 1 || busy}
                    onPress={() => move(i, 1)}
                    className={`border-border h-10 w-10 items-center justify-center rounded-lg border ${
                      i === sections.length - 1 || busy ? "opacity-30" : ""
                    }`}
                  >
                    <Text className="text-foreground text-base">↓</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <Text className="text-muted-foreground text-xs">
              {c.available} available · {c.held} held · {c.sold} sold ·{" "}
              {c.blocked} blocked
            </Text>
            <View className="flex-row gap-2">
              <SmallButton
                label={canWrite ? "Seats" : "View seats"}
                onPress={() =>
                  router.push({
                    pathname: "/admin/events/[id]/seats",
                    params: { id: eventId, sectionId: section.id },
                  })
                }
              />
              {canWrite ? (
                <>
                  <SmallButton
                    label="Edit"
                    onPress={() =>
                      router.push({
                        pathname: "/admin/events/[id]/section",
                        params: { id: eventId, sectionId: section.id },
                      })
                    }
                  />
                  <SmallButton
                    label="Delete"
                    destructive
                    disabled={committed || busy}
                    onPress={() =>
                      confirm({
                        title: `Delete section “${section.name}”?`,
                        message: `All ${seats.length} seats in it are removed. Sections with held or sold seats can't be deleted.`,
                        confirmLabel: "Delete",
                        destructive: true,
                        onConfirm: () => remove.mutate({ id: section.id }),
                      })
                    }
                  />
                </>
              ) : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
