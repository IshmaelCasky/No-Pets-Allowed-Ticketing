import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import type { EventStatus } from "@npa/validators";

import type { RouterOutputs } from "~/utils/api";
import {
  Chips,
  ListFooter,
  Pill,
  RequirePerm,
  SearchBar,
} from "~/components/admin";
import {
  EVENT_STATUS_OPTIONS,
  EVENT_STATUS_TONE,
  eventStatusLabel,
} from "~/components/events-admin/status";
import { Empty, Loading } from "~/components/ui";
import { trpc, trpcClient } from "~/utils/api";
import { formatManila } from "~/utils/format";
import { usePagedList } from "~/utils/use-paged-list";
import { usePermissions } from "~/utils/use-permissions";

type Concert = RouterOutputs["event"]["list"]["items"][number];

const PAGE_SIZE = 30;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ConcertRow({
  concert,
  onPress,
}: {
  concert: Concert;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="border-border bg-card flex-row items-center gap-3 rounded-xl border p-3 active:opacity-70"
    >
      {concert.posterUrl ? (
        <Image
          source={{ uri: concert.posterUrl }}
          className="bg-muted h-16 w-12 rounded-md"
          resizeMode="cover"
        />
      ) : (
        <View className="bg-muted h-16 w-12 items-center justify-center rounded-md">
          <Text className="text-lg">🎵</Text>
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <Text
          className="text-foreground text-base font-semibold"
          numberOfLines={1}
        >
          {concert.title}
        </Text>
        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
          {formatManila(concert.startsAt)}
        </Text>
        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
          {[concert.venue, concert.seatingMode === "ga" ? "GA" : "Reserved"]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Pill
        label={eventStatusLabel(concert.status)}
        tone={EVENT_STATUS_TONE[concert.status]}
      />
      <Text className="text-muted-foreground text-lg">›</Text>
    </Pressable>
  );
}

function ConcertsList() {
  const router = useRouter();
  const { has } = usePermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EventStatus | undefined>();
  const debounced = useDebounced(search.trim(), 300);

  const input = { search: debounced || undefined, status, pageSize: PAGE_SIZE };
  const list = usePagedList<Concert, RouterOutputs["event"]["list"]>(
    [...trpc.event.list.pathKey(), input],
    (page) => trpcClient.event.list.query({ ...input, page }),
  );

  const rows = list.items;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerRight: has("events:write")
            ? () => (
                <Pressable
                  hitSlop={10}
                  onPress={() => router.push("/admin/events/new")}
                >
                  <Text className="text-base font-semibold text-white">
                    + New
                  </Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <View className="gap-3 px-4 pt-3 pb-2">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search title or slug…"
        />
        <Chips
          options={EVENT_STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          allLabel="All"
        />
      </View>
      {list.isLoading ? (
        <Loading />
      ) : list.isError ? (
        <Empty title="Couldn't load concerts" hint={list.error.message} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(e) => e.id}
          contentContainerClassName="gap-2 px-4 pb-6"
          renderItem={({ item }) => (
            <ConcertRow
              concert={item}
              onPress={() =>
                router.push({
                  pathname: "/admin/events/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => void list.refetch()}
              tintColor="#2f7de6"
            />
          }
          ListEmptyComponent={
            <Empty
              title={
                status || debounced ? "No matching concerts" : "No concerts yet"
              }
              hint={
                has("events:write") && !status && !debounced
                  ? "Tap “+ New” to create one."
                  : undefined
              }
            />
          }
          ListFooterComponent={
            <ListFooter
              loading={list.isFetchingNextPage}
              shown={rows.length}
              total={list.total}
            />
          }
        />
      )}
    </View>
  );
}

export default function ConcertsScreen() {
  return (
    <RequirePerm anyOf={["events:read"]}>
      <ConcertsList />
    </RequirePerm>
  );
}
