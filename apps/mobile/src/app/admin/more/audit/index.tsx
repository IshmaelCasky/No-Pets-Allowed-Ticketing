import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import type { AuditPage, AuditRow } from "~/components/people/audit-cache";
import type { AuditFilterState } from "~/components/people/audit-filters";
import type { AuditEntityType } from "~/components/people/labels";
import {
  Chips,
  ListFooter,
  ListRow,
  Pill,
  RequirePerm,
} from "~/components/admin";
import { auditListKey } from "~/components/people/audit-cache";
import {
  activeFilterCount,
  EMPTY_AUDIT_FILTERS,
  isValidDay,
  setAuditFilters,
  toAuditInput,
  useAuditFilters,
} from "~/components/people/audit-filters";
import { HeaderAction, useDebounced } from "~/components/people/controls";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  auditActionLabel,
  auditActionTone,
  entityTypeLabel,
} from "~/components/people/labels";
import { Button, Empty, Field, Loading } from "~/components/ui";
import { trpcClient } from "~/utils/api";
import { showError } from "~/utils/feedback";
import { formatManila } from "~/utils/format";
import { shareCsv } from "~/utils/share-csv";
import { usePagedList } from "~/utils/use-paged-list";

const isKnownEntity = (v: string): v is AuditEntityType =>
  AUDIT_ENTITY_TYPES.some((e) => e.value === v);

function dayError(v: string): string | undefined {
  return v.trim() && !isValidDay(v.trim()) ? "Use YYYY-MM-DD" : undefined;
}

/** Collapsible filter panel: entity, action, actor, entity id, date range. */
function Filters({ filters }: { filters: AuditFilterState }) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  const set = (patch: Partial<AuditFilterState>) =>
    setAuditFilters((prev) => ({ ...prev, ...patch }));
  const entity = isKnownEntity(filters.entityType)
    ? filters.entityType
    : undefined;
  const actions = entity ? AUDIT_ACTIONS[entity] : [];

  return (
    <View className="border-border bg-card overflow-hidden rounded-xl border">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between p-3 active:opacity-70"
      >
        <Text className="text-foreground text-base font-semibold">
          Filters{count ? ` (${count})` : ""}
        </Text>
        <View className="flex-row items-center gap-4">
          {count ? (
            <Pressable
              hitSlop={8}
              onPress={() => setAuditFilters(EMPTY_AUDIT_FILTERS)}
            >
              <Text className="text-primary text-sm font-semibold">Clear</Text>
            </Pressable>
          ) : null}
          <Text className="text-muted-foreground">{open ? "⌃" : "⌄"}</Text>
        </View>
      </Pressable>

      {/* Quick entity chips are always visible. */}
      <View className="px-3 pb-3">
        <Chips
          allLabel="All entities"
          options={AUDIT_ENTITY_TYPES}
          value={entity}
          onChange={(v) => set({ entityType: v ?? "", action: "" })}
        />
      </View>

      {open ? (
        <View className="border-border gap-3 border-t p-3">
          {actions.length > 0 ? (
            <Chips
              allLabel="Any action"
              options={actions.map((a) => ({
                value: a,
                label: a.slice(a.indexOf(".") + 1).replace(/_/g, " "),
              }))}
              value={
                actions.includes(filters.action) ? filters.action : undefined
              }
              onChange={(v) => set({ action: v ?? "" })}
            />
          ) : null}
          <Field
            label="Action (exact)"
            value={filters.action}
            onChangeText={(action) => set({ action })}
            placeholder="e.g. order.cancel"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {filters.actorLabel && filters.actorId ? (
            <View className="gap-1">
              <Text className="text-foreground text-sm font-medium">Actor</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground text-base">
                  {filters.actorLabel}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => set({ actorId: "", actorLabel: "" })}
                >
                  <Text className="text-primary text-sm font-semibold">
                    Remove
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Field
              label="Actor user ID"
              value={filters.actorId}
              onChangeText={(actorId) => set({ actorId, actorLabel: "" })}
              placeholder="Tip: open an entry → “All by this person”"
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
          <Field
            label="Entity ID"
            value={filters.entityId}
            onChangeText={(entityId) => set({ entityId })}
            placeholder="Exact ID"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="From (Manila)"
                value={filters.dateFrom}
                onChangeText={(dateFrom) => set({ dateFrom })}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                error={dayError(filters.dateFrom)}
              />
            </View>
            <View className="flex-1">
              <Field
                label="To (Manila)"
                value={filters.dateTo}
                onChangeText={(dateTo) => set({ dateTo })}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                error={dayError(filters.dateTo)}
              />
            </View>
          </View>
          {count ? (
            <Button
              label="Clear all filters"
              variant="outline"
              onPress={() => setAuditFilters(EMPTY_AUDIT_FILTERS)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AuditList() {
  const router = useRouter();
  const filters = useAuditFilters();
  const debounced = useDebounced(filters, 400);
  const input = toAuditInput(debounced);
  const [exporting, setExporting] = useState(false);
  // Filters live in memory only while the module is open.
  useEffect(() => () => setAuditFilters(EMPTY_AUDIT_FILTERS), []);

  const list = usePagedList<AuditRow, AuditPage>(
    [...auditListKey(), input],
    (page) => trpcClient.audit.list.query({ ...input, page }),
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await trpcClient.audit.exportCsv.query(input);
      const stamp = new Date().toISOString().slice(0, 10);
      await shareCsv(`audit-logs-${stamp}.csv`, csv);
    } catch (e) {
      showError(e, "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const renderItem = ({ item }: { item: AuditRow }) => (
    <ListRow
      title={auditActionLabel(item.action)}
      subtitle={`${item.actorName ?? (item.actorId ? "Deleted user" : "System")} · ${entityTypeLabel(item.entityType)}`}
      meta={formatManila(item.createdAt)}
      right={
        <Pill
          label={item.action
            .slice(item.action.indexOf(".") + 1)
            .replace(/_/g, " ")}
          tone={auditActionTone(item.action)}
        />
      }
      onPress={() => router.push(`/admin/more/audit/${item.id}`)}
    />
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderAction
              label={exporting ? "Exporting…" : "Export CSV"}
              onPress={() => {
                if (!exporting) void exportCsv();
              }}
            />
          ),
        }}
      />
      <FlatList
        data={list.items}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerClassName="p-4 gap-2 pb-24"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="pb-2">
            <Filters filters={filters} />
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? (
            <Loading />
          ) : list.isError ? (
            <Empty title="Couldn't load audit log" hint={list.error.message} />
          ) : (
            <Empty
              title="No entries"
              hint="No audit entries match these filters."
            />
          )
        }
        ListFooterComponent={
          <ListFooter
            loading={list.isFetchingNextPage}
            shown={list.items.length}
            total={list.total}
          />
        }
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => void list.refetch()}
      />
    </>
  );
}

export default function AuditScreen() {
  return (
    <RequirePerm anyOf={["audit:read"]}>
      <AuditList />
    </RequirePerm>
  );
}
