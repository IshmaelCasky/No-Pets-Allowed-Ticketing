import { useCallback, useState } from "react";
import { Image, RefreshControl, ScrollView, Text, View } from "react-native";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { EventStatus } from "@npa/validators";

import type { RouterOutputs } from "~/utils/api";
import { KeyValue, Pill, RequirePerm, SectionHeader } from "~/components/admin";
import { SectionPanel } from "~/components/events-admin/section-panel";
import {
  EVENT_STATUS_TONE,
  eventStatusLabel,
  seatingModeLabel,
} from "~/components/events-admin/status";
import { TierPanel } from "~/components/events-admin/tier-panel";
import { useConcertInventory } from "~/components/events-admin/use-inventory";
import { Button, Card, Empty, Loading } from "~/components/ui";
import { trpc, trpcClient } from "~/utils/api";
import { confirm, showError } from "~/utils/feedback";
import { formatManila } from "~/utils/format";
import { shareCsv } from "~/utils/share-csv";
import { usePermissions } from "~/utils/use-permissions";

type Concert = NonNullable<RouterOutputs["event"]["byId"]>;

interface StatusAction {
  to: EventStatus;
  label: string;
  title: string;
  message: string;
  variant: "primary" | "outline" | "destructive";
}

/** Status transitions offered for each current status. */
function statusActions(status: EventStatus): StatusAction[] {
  const cancel: StatusAction = {
    to: "cancelled",
    label: "Cancel concert",
    title: "Cancel this concert?",
    message:
      "It disappears from the storefront and no new orders can be placed. Existing orders and tickets are not refunded or voided automatically.",
    variant: "destructive",
  };
  switch (status) {
    case "draft":
      return [
        {
          to: "published",
          label: "Publish",
          title: "Publish this concert?",
          message: "It becomes visible to customers and tickets go on sale.",
          variant: "primary",
        },
        cancel,
      ];
    case "published":
      return [
        {
          to: "draft",
          label: "Unpublish",
          title: "Unpublish this concert?",
          message: "It's hidden from customers and moves back to draft.",
          variant: "outline",
        },
        {
          to: "ended",
          label: "Mark as ended",
          title: "Mark this concert as ended?",
          message: "It's removed from the storefront as a past show.",
          variant: "outline",
        },
        cancel,
      ];
    case "ended":
      return [
        {
          to: "draft",
          label: "Move back to draft",
          title: "Move back to draft?",
          message: "Use this if the concert was ended by mistake.",
          variant: "outline",
        },
      ];
    case "cancelled":
      return [
        {
          to: "draft",
          label: "Restore to draft",
          title: "Restore this concert?",
          message: "It moves back to draft. Publish it again to sell tickets.",
          variant: "outline",
        },
      ];
  }
}

function Facts({ concert }: { concert: Concert }) {
  return (
    <Card className="gap-1">
      {concert.posterUrl ? (
        <Image
          source={{ uri: concert.posterUrl }}
          className="bg-muted mb-3 h-56 w-full rounded-lg"
          resizeMode="cover"
        />
      ) : null}
      <View className="mb-2 flex-row items-start gap-3">
        <Text className="text-foreground flex-1 text-xl font-bold">
          {concert.title}
        </Text>
        <Pill
          label={eventStatusLabel(concert.status)}
          tone={EVENT_STATUS_TONE[concert.status]}
        />
      </View>
      <KeyValue label="Starts" value={formatManila(concert.startsAt)} />
      <KeyValue label="Doors open" value={formatManila(concert.doorsOpenAt)} />
      <KeyValue label="Venue" value={concert.venue ?? "—"} />
      <KeyValue label="Seating" value={seatingModeLabel(concert.seatingMode)} />
      <KeyValue label="Max per order" value={concert.maxPerOrder} />
      <KeyValue
        label="Refund cutoff"
        value={`${concert.refundCutoffDays} day${
          concert.refundCutoffDays === 1 ? "" : "s"
        } before`}
      />
      <KeyValue label="Slug" value={concert.slug} />
      {concert.lineup ? (
        <KeyValue label="Lineup" value={concert.lineup} />
      ) : null}
      {concert.description ? (
        <Text className="text-muted-foreground mt-2 text-sm">
          {concert.description}
        </Text>
      ) : null}
    </Card>
  );
}

function ConcertDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canWrite = has("events:write");
  const canDelete = has("events:delete");

  const eventQ = useQuery(trpc.event.byId.queryOptions({ id }));
  const inventory = useConcertInventory(id);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { refetch: refetchEvent } = eventQ;
  useFocusEffect(
    useCallback(() => {
      void refetchEvent();
    }, [refetchEvent]),
  );

  const invalidateConcert = () => {
    void queryClient.invalidateQueries(trpc.event.byId.queryFilter({ id }));
    void queryClient.invalidateQueries(trpc.event.list.pathFilter());
  };

  const setStatus = useMutation(
    trpc.event.setStatus.mutationOptions({
      onSuccess: () => invalidateConcert(),
      onError: (e) => showError(e),
    }),
  );
  const remove = useMutation(
    trpc.event.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.event.list.pathFilter());
        queryClient.removeQueries(trpc.event.byId.queryFilter({ id }));
        router.back();
      },
      onError: (e) => showError(e, "Couldn't delete concert"),
    }),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), inventory.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const exportAttendees = async (concert: Concert) => {
    setExporting(true);
    try {
      // Fetched imperatively so the CSV never sits in the query cache.
      const csv = await trpcClient.event.attendeesCsv.query({ id });
      await shareCsv(`attendees-${concert.slug}`, csv);
    } catch (e) {
      showError(e, "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (eventQ.isLoading) return <Loading />;
  if (eventQ.isError) {
    return <Empty title="Couldn't load concert" hint={eventQ.error.message} />;
  }
  const concert = eventQ.data;
  if (!concert) return <Empty title="Concert not found" />;

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-4 pb-12"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor="#2f7de6"
        />
      }
    >
      <Stack.Screen options={{ title: concert.title }} />
      <Facts concert={concert} />

      <View className="gap-2">
        <SectionHeader title="Actions" />
        {canWrite ? (
          <Button
            label="Edit details"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/admin/events/[id]/edit",
                params: { id },
              })
            }
          />
        ) : null}
        {canWrite
          ? statusActions(concert.status).map((a) => (
              <Button
                key={a.to}
                label={a.label}
                variant={a.variant}
                loading={
                  setStatus.isPending && setStatus.variables.status === a.to
                }
                disabled={setStatus.isPending}
                onPress={() =>
                  confirm({
                    title: a.title,
                    message: a.message,
                    confirmLabel: a.label,
                    destructive: a.variant === "destructive",
                    onConfirm: () => setStatus.mutate({ id, status: a.to }),
                  })
                }
              />
            ))
          : null}
        <Button
          label="Export attendees (CSV)"
          variant="outline"
          loading={exporting}
          onPress={() => void exportAttendees(concert)}
        />
      </View>

      {concert.seatingMode === "ga" ? (
        <TierPanel eventId={id} tiers={inventory.tiers} canWrite={canWrite} />
      ) : (
        <SectionPanel
          eventId={id}
          sections={inventory.sections}
          seatsBySection={inventory.seatsBySection}
          canWrite={canWrite}
        />
      )}

      {canDelete ? (
        <View className="gap-2 pt-4">
          <SectionHeader title="Danger zone" />
          <Button
            label="Delete concert"
            variant="destructive"
            loading={remove.isPending}
            onPress={() =>
              confirm({
                title: "Delete this concert?",
                message:
                  "This cannot be undone. Concerts with orders cannot be deleted.",
                confirmLabel: "Delete",
                destructive: true,
                onConfirm: () => remove.mutate({ id }),
              })
            }
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function ConcertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequirePerm anyOf={["events:read"]}>
      <ConcertDetail id={id} />
    </RequirePerm>
  );
}
