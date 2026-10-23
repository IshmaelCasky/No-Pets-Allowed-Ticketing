/** Transactions → Refunds: request queue with status + concert filters. */
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";

import type { RefundStatus } from "@npa/validators";
import { REFUND_STATUSES } from "@npa/validators";

import type { RouterInputs, RouterOutputs } from "~/utils/api";
import { Chips, ListFooter, ListRow, Pill } from "~/components/admin";
import { Empty, Loading } from "~/components/ui";
import { trpc, trpcClient } from "~/utils/api";
import { formatCentavos, formatManila } from "~/utils/format";
import { usePagedList } from "~/utils/use-paged-list";
import { useConcertTitles } from "../hooks";
import { SelectField } from "../select";
import { REFUND_STATUS_LABEL, REFUND_STATUS_TONE } from "../status";

type Page = RouterOutputs["refund"]["queue"];
type Refund = Page["items"][number];

const STATUS_OPTIONS = REFUND_STATUSES.map((s) => ({
  value: s,
  label: REFUND_STATUS_LABEL[s],
}));

export const REFUND_PAGE_SIZE = 20;

export function RefundsList() {
  const router = useRouter();
  const [status, setStatus] = useState<RefundStatus | undefined>();
  const [eventId, setEventId] = useState<string | undefined>();
  const concerts = useConcertTitles();

  const input = {
    pageSize: REFUND_PAGE_SIZE,
    status,
    eventId,
  } satisfies Omit<RouterInputs["refund"]["queue"], "page">;

  const list = usePagedList<Refund, Page>(
    [...trpc.refund.queue.pathKey(), input],
    (page) => trpcClient.refund.queue.query({ ...input, page }),
  );

  return (
    <View className="flex-1">
      <View className="gap-2 px-4 pb-2">
        <SelectField
          title="Concert"
          options={concerts.options}
          value={eventId}
          placeholder="All concerts"
          allLabel="All concerts"
          onChange={setEventId}
        />
        <Chips
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          allLabel="All"
        />
      </View>
      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-2 px-4 pb-6 grow"
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => void list.refetch()}
              tintColor="#c03484"
            />
          }
          ListEmptyComponent={
            <Empty
              title="No refund requests"
              hint={list.error ? list.error.message : undefined}
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
              title={item.orderCode ?? "Refund request"}
              subtitle={[
                item.totalAmount != null
                  ? formatCentavos(item.totalAmount)
                  : null,
                item.buyerName ?? item.buyerEmail,
              ]
                .filter(Boolean)
                .join(" · ")}
              meta={`${item.eventTitle ?? "Concert"} · ${formatManila(
                item.createdAt,
              )}`}
              right={
                <Pill
                  label={REFUND_STATUS_LABEL[item.status]}
                  tone={REFUND_STATUS_TONE[item.status]}
                />
              }
              onPress={() => router.push(`/admin/sales/refund/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
