/** Concert selection for the Gate (scanner, check-ins). */
import type { ReactNode } from "react";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { ListRow, Pill } from "~/components/admin";
import { Empty, Loading } from "~/components/ui";
import { errorMessage } from "~/utils/feedback";
import { formatManila } from "~/utils/format";
import { useScanConcerts } from "../hooks";
import { SelectSheet } from "../select";

/** Full-screen list shown until a concert is picked. */
export function ConcertChooser({
  onPick,
  prompt = "Pick a concert",
}: {
  onPick: (eventId: string) => void;
  prompt?: string;
}) {
  const concerts = useScanConcerts();
  if (concerts.isLoading) return <Loading />;
  return (
    <FlatList
      data={concerts.data ?? []}
      keyExtractor={(e) => e.id}
      contentContainerClassName="gap-2 p-4 grow"
      refreshControl={
        <RefreshControl
          refreshing={concerts.isRefetching}
          onRefresh={() => void concerts.refetch()}
          tintColor="#2f7de6"
        />
      }
      ListHeaderComponent={
        <Text className="text-foreground pb-1 text-lg font-bold">{prompt}</Text>
      }
      ListEmptyComponent={
        <Empty
          title="No concerts to scan"
          hint={
            concerts.error
              ? errorMessage(concerts.error)
              : "Published concerts show up here."
          }
        />
      }
      renderItem={({ item }) => (
        <ListRow
          title={item.title}
          subtitle={item.startsAt ? formatManila(item.startsAt) : null}
          right={
            item.status !== "published" ? (
              <Pill label={item.status} tone="gray" />
            ) : null
          }
          onPress={() => onPick(item.id)}
        />
      )}
    />
  );
}

/** Compact bar: current concert + "Change", with an optional right slot. */
export function ConcertBar({
  eventId,
  onChange,
  right,
}: {
  eventId: string;
  onChange: (eventId: string) => void;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const concerts = useScanConcerts();
  const title =
    concerts.data?.find((e) => e.id === eventId)?.title ?? "Concert";
  return (
    <View className="border-border bg-card flex-row items-center gap-3 border-b px-4 py-2.5">
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-1 active:opacity-70"
      >
        <Text className="text-muted-foreground text-xs">Concert ▾</Text>
        <Text className="text-foreground text-base font-bold" numberOfLines={1}>
          {title}
        </Text>
      </Pressable>
      {right}
      <SelectSheet
        visible={open}
        title="Concert"
        options={concerts.options}
        value={eventId}
        onSelect={(v) => {
          if (v) onChange(v);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
