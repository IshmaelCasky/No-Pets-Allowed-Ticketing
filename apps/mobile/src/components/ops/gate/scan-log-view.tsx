/**
 * Gate → Scan log: every scan attempt incl. failures. Filters: concert
 * (optional), result, staff, search. Raw values only appear for `not_found`
 * codes (`rawValuePreview`) — real ones are ticket tokens and never shown.
 */
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import type { ScanResult } from "@npa/validators";
import { SCAN_RESULTS } from "@npa/validators";

import type { RouterInputs, RouterOutputs } from "~/utils/api";
import {
  Chips,
  ListFooter,
  ListRow,
  Pill,
  SearchBar,
} from "~/components/admin";
import { Button, Empty, Loading } from "~/components/ui";
import { trpc, trpcClient } from "~/utils/api";
import { formatManila } from "~/utils/format";
import { usePagedList } from "~/utils/use-paged-list";
import { useCsvExport } from "../csv";
import { manilaStamp } from "../format";
import { useDebounced, useFocusInterval, useScanConcerts } from "../hooks";
import { SelectField } from "../select";
import { SCAN_RESULT_LABEL, SCAN_RESULT_TONE } from "../status";

type Page = RouterOutputs["scan"]["logs"];
type Row = Page["items"][number];

const RESULT_OPTIONS = SCAN_RESULTS.map((r) => ({
  value: r,
  label: SCAN_RESULT_LABEL[r],
}));

function rowTitle(r: Row): string {
  const name = r.holderName ?? r.buyerName;
  if (name) return name;
  if (r.rawValuePreview) return `Unknown code “${r.rawValuePreview}”`;
  return "Unknown ticket";
}

export function ScanLogView({ initialEventId }: { initialEventId?: string }) {
  const [eventId, setEventId] = useState<string | undefined>(initialEventId);
  const [result, setResult] = useState<ScanResult | undefined>();
  const [scannedById, setScannedById] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search.trim());
  const concerts = useScanConcerts();
  const csv = useCsvExport();

  const staffQ = useQuery(trpc.scan.scannerOptions.queryOptions({ eventId }));
  const staffOptions = useMemo(
    () => (staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    [staffQ.data],
  );

  const filters = {
    eventId,
    result,
    scannedById,
    search: debounced || undefined,
  } satisfies Omit<RouterInputs["scan"]["logs"], "page">;
  const input = { ...filters, pageSize: 30 };

  const list = usePagedList<Row, Page>(
    [...trpc.scan.logs.pathKey(), input],
    (page) => trpcClient.scan.logs.query({ ...input, page }),
  );
  useFocusInterval(() => void list.refetch(), 15_000);

  const concertTitle = concerts.data?.find((e) => e.id === eventId)?.title;

  return (
    <View className="flex-1">
      <View className="gap-2 px-4 pt-3 pb-2">
        <View className="flex-row gap-2">
          <SelectField
            title="Concert"
            options={concerts.options}
            value={eventId}
            placeholder="All concerts"
            allLabel="All concerts"
            onChange={(v) => {
              setEventId(v);
              setScannedById(undefined);
            }}
          />
          <SelectField
            title="Staff"
            options={staffOptions}
            value={scannedById}
            placeholder="All staff"
            allLabel="All staff"
            emptyLabel="No one has scanned yet."
            onChange={setScannedById}
          />
        </View>
        <Chips
          options={RESULT_OPTIONS}
          value={result}
          onChange={setResult}
          allLabel="All results"
        />
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Holder, buyer, order, seat"
            />
          </View>
          <Button
            label="CSV"
            variant="outline"
            loading={csv.exporting}
            onPress={() =>
              void csv.run(
                `scan-log-${concertTitle ?? "all-concerts"}-${manilaStamp()}`,
                () => trpcClient.scan.exportLogsCsv.query(filters),
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
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-2 px-4 pb-6 grow"
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => void list.refetch()}
              tintColor="#c03484"
            />
          }
          ListEmptyComponent={
            <Empty
              title="No scans"
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
              title={rowTitle(item)}
              subtitle={
                [item.seatLabel ?? item.tierName, item.orderCode]
                  .filter(Boolean)
                  .join(" · ") || null
              }
              meta={[
                formatManila(item.createdAt),
                item.scannedByName,
                eventId ? null : item.eventTitle,
              ]
                .filter(Boolean)
                .join(" · ")}
              right={
                <Pill
                  label={SCAN_RESULT_LABEL[item.result]}
                  tone={SCAN_RESULT_TONE[item.result]}
                />
              }
            />
          )}
        />
      )}
    </View>
  );
}
