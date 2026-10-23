/** Transactions → Orders: search code / buyer, status + concert filters, infinite list. */
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";

import type { OrderStatus } from "@npa/validators";

import type { RouterInputs, RouterOutputs } from "~/utils/api";
import { Chips, ListFooter, ListRow, SearchBar } from "~/components/admin";
import { Empty, Loading, StatusBadge } from "~/components/ui";
import { trpc, trpcClient } from "~/utils/api";
import { formatCentavos, formatManila } from "~/utils/format";
import { usePagedList } from "~/utils/use-paged-list";
import { useConcertTitles, useDebounced } from "../hooks";
import { SelectField } from "../select";
import { hitpayLabel } from "../status";

type Page = RouterOutputs["order"]["adminList"];
type Order = Page["items"][number];

/** The HitPay lifecycle (legacy `for_review` / `rejected` are unused). */
const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending_payment", label: "Pending payment" },
  { value: "approved", label: "Approved" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const PAGE_SIZE = 20;

export function OrdersList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [eventId, setEventId] = useState<string | undefined>();
  const debounced = useDebounced(search.trim());
  const concerts = useConcertTitles();

  const input = {
    pageSize: PAGE_SIZE,
    search: debounced || undefined,
    status,
    eventId,
  } satisfies Omit<RouterInputs["order"]["adminList"], "page">;

  const list = usePagedList<Order, Page>(
    [...trpc.order.adminList.pathKey(), input],
    (page) => trpcClient.order.adminList.query({ ...input, page }),
  );

  return (
    <View className="flex-1">
      <View className="gap-2 px-4 pb-2">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Order code, buyer name or email"
        />
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
          keyExtractor={(o) => o.id}
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
              title="No orders found"
              hint={
                list.error
                  ? list.error.message
                  : "Try another search or filter."
              }
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
              title={item.code}
              subtitle={[
                item.buyerName ?? item.buyerEmail,
                item.eventTitle ?? "Concert",
              ]
                .filter(Boolean)
                .join(" · ")}
              meta={`${formatCentavos(item.totalAmount)} · ${formatManila(
                item.createdAt,
              )} · HitPay: ${hitpayLabel(item.hitpayStatus)}`}
              right={<StatusBadge status={item.status} />}
              onPress={() => router.push(`/admin/sales/order/${item.code}`)}
            />
          )}
        />
      )}
    </View>
  );
}
