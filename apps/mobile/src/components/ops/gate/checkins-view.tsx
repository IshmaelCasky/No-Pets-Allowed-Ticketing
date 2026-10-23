/**
 * Gate → Check-ins: every live ticket for the concert with arrival state,
 * counts + progress, filter, search, CSV export. Refreshes every 15 s while
 * the Gate screen is focused.
 */
import { useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import type { CheckinFilter } from "@npa/validators";

import type { RouterInputs, RouterOutputs } from "~/utils/api";
import {
  ListFooter,
  ListRow,
  Pill,
  SearchBar,
  Segmented,
} from "~/components/admin";
import { Button, Empty, Loading } from "~/components/ui";
import { trpc, trpcClient } from "~/utils/api";
import { formatManila } from "~/utils/format";
import { usePagedList } from "~/utils/use-paged-list";
import { useCsvExport } from "../csv";
import { manilaStamp } from "../format";
import { useDebounced, useFocusInterval, useScanConcerts } from "../hooks";
import { ConcertBar } from "./concert";

type Page = RouterOutputs["scan"]["checkins"];
type Row = Page["items"][number];

const FILTERS: { value: CheckinFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "checked_in", label: "Checked in" },
  { value: "not_checked_in", label: "Not yet" },
];

const REFRESH_MS = 15_000;

export function CheckinsView({
  eventId,
  onChangeConcert,
}: {
  eventId: string;
  onChangeConcert: (eventId: string) => void;
}) {
  const [status, setStatus] = useState<CheckinFilter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search.trim());
  const concerts = useScanConcerts();
  const csv = useCsvExport();

  const input = {
    eventId,
    status,
    search: debounced || undefined,
    pageSize: 30,
  } satisfies Omit<RouterInputs["scan"]["checkins"], "page">;

  const list = usePagedList<Row, Page>(
    [...trpc.scan.checkins.pathKey(), input],
    (page) => trpcClient.scan.checkins.query({ ...input, page }),
  );
  useFocusInterval(() => void list.refetch(), REFRESH_MS);

  const checkedIn = list.first?.checkedIn ?? 0;
  const totalTickets = list.first?.totalTickets ?? 0;
  const pct = totalTickets > 0 ? (checkedIn / totalTickets) * 100 : 0;
  const title =
    concerts.data?.find((e) => e.id === eventId)?.title ?? "concert";

  return (
    <View className="flex-1">
      <ConcertBar eventId={eventId} onChange={onChangeConcert} />
      <View className="gap-2 px-4 pt-3 pb-2">
        <View className="gap-1.5">
          <View className="flex-row items-end justify-between">
            <Text className="text-foreground text-lg font-bold">
              Checked in {checkedIn} / {totalTickets}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {Math.round(pct)}%
            </Text>
          </View>
          <View className="bg-muted h-2.5 overflow-hidden rounded-full">
            <View
              className="bg-primary h-full rounded-full"
              style={{ width: `${pct}%` }}
            />
          </View>
        </View>
        <Segmented options={FILTERS} value={status} onChange={setStatus} />
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Name, email, order, seat"
            />
          </View>
          <Button
            label="CSV"
            variant="outline"
            loading={csv.exporting}
            onPress={() =>
              void csv.run(`checkins-${title}-${manilaStamp()}`, () =>
                trpcClient.scan.exportCheckinsCsv.query({
                  eventId,
                  status,
                  search: debounced || undefined,
                }),
              )
            }
          />
        </View>
      </View>
      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(r) => r.ticketId}
          contentContainerClassName="gap-2 px-4 pb-6 grow"
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => void list.refetch()}
              tintColor="#2f7de6"
            />
          }
          ListEmptyComponent={
            <Empty
              title="No tickets"
              hint={list.error ? list.error.message : "Nothing matches yet."}
            />
          }
          ListFooterComponent={
            <ListFooter
              loading={list.isFetchingNextPage}
              shown={list.items.length}
              total={list.total}
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.holderName ?? item.buyerName ?? "—"}
              subtitle={[item.seatLabel ?? item.tierName, item.orderCode]
                .filter(Boolean)
                .join(" · ")}
              meta={
                item.status === "used"
                  ? `${formatManila(item.usedAt)}${
                      item.usedByName ? ` · ${item.usedByName}` : ""
                    }`
                  : (item.buyerEmail ?? null)
              }
              right={
                item.status === "used" ? (
                  <Pill label="Checked in" tone="green" />
                ) : (
                  <Pill label="Not yet" tone="gray" />
                )
              }
            />
          )}
        />
      )}
    </View>
  );
}
