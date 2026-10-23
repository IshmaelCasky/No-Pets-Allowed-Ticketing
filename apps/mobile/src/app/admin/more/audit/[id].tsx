import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuditRow } from "~/components/people/audit-cache";
import { KeyValue, Pill, RequirePerm, SectionHeader } from "~/components/admin";
import { findCachedAuditRow } from "~/components/people/audit-cache";
import {
  EMPTY_AUDIT_FILTERS,
  setAuditFilters,
} from "~/components/people/audit-filters";
import { JsonBlock, JsonDiff } from "~/components/people/json-diff";
import {
  auditActionLabel,
  auditActionTone,
  entityTypeLabel,
} from "~/components/people/labels";
import { Button, Card, Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { errorMessage } from "~/utils/feedback";
import { formatManila } from "~/utils/format";
import { usePermissions } from "~/utils/use-permissions";

/** Read-only detail of one audit entry: summary, field diff, raw JSON. */
function AuditDetail({ row }: { row: AuditRow }) {
  const router = useRouter();
  const { has } = usePermissions();
  const actor = row.actorName ?? (row.actorId ? "Deleted user" : "System");

  const filterAndBack = (patch: Partial<typeof EMPTY_AUDIT_FILTERS>) => {
    setAuditFilters({ ...EMPTY_AUDIT_FILTERS, ...patch });
    router.back();
  };

  const entityId = row.entityId;
  const openEntity =
    entityId && row.entityType === "user" && has("users:read")
      ? () => router.push(`/admin/more/users/${entityId}`)
      : entityId && row.entityType === "role" && has("roles:write")
        ? () => router.push(`/admin/more/roles/${entityId}`)
        : null;

  return (
    <ScrollView contentContainerClassName="p-4 gap-3 pb-28">
      <Stack.Screen options={{ title: auditActionLabel(row.action) }} />
      <Card className="gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-foreground flex-1 text-lg font-bold">
            {auditActionLabel(row.action)}
          </Text>
          <Pill
            label={row.action
              .slice(row.action.indexOf(".") + 1)
              .replace(/_/g, " ")}
            tone={auditActionTone(row.action)}
          />
        </View>
        <View className="pt-2">
          <KeyValue label="When" value={formatManila(row.createdAt)} />
          <KeyValue label="Actor" value={actor} />
          <KeyValue label="Action" value={row.action} />
          <KeyValue label="Entity" value={entityTypeLabel(row.entityType)} />
          <KeyValue
            label="Entity ID"
            value={
              <Text className="text-foreground font-mono text-xs" selectable>
                {row.entityId ?? "—"}
              </Text>
            }
          />
          <KeyValue label="IP" value={row.ip ?? "—"} />
          {row.userAgent ? (
            <KeyValue
              label="Device"
              value={
                <Text
                  className="text-muted-foreground text-right text-xs"
                  numberOfLines={3}
                >
                  {row.userAgent}
                </Text>
              }
            />
          ) : null}
        </View>
      </Card>

      <View className="gap-2">
        {row.actorId ? (
          <Button
            label={`All by ${actor}`}
            variant="outline"
            onPress={() =>
              filterAndBack({
                actorId: row.actorId ?? "",
                actorLabel: actor,
              })
            }
          />
        ) : null}
        {row.entityId ? (
          <Button
            label={`History of this ${entityTypeLabel(row.entityType).toLowerCase()}`}
            variant="outline"
            onPress={() =>
              filterAndBack({
                entityType: row.entityType,
                entityId: row.entityId ?? "",
              })
            }
          />
        ) : null}
        {openEntity ? (
          <Button
            label={`Open ${entityTypeLabel(row.entityType).toLowerCase()}`}
            variant="secondary"
            onPress={openEntity}
          />
        ) : null}
      </View>

      <SectionHeader title="Changes" />
      <JsonDiff before={row.before} after={row.after} />

      <SectionHeader title="Raw data" />
      <JsonBlock label="Before" value={row.before} />
      <JsonBlock label="After" value={row.after} />
    </ScrollView>
  );
}

function AuditDetailLoader({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  // Show the row from the list cache instantly, then load it from the API
  // (also covers deep links / a cleared cache).
  const query = useQuery({
    ...trpc.audit.byId.queryOptions({ id }),
    initialData: () => findCachedAuditRow(queryClient, id),
  });
  if (query.data) return <AuditDetail row={query.data} />;
  if (query.isLoading) return <Loading />;
  return (
    <View className="flex-1 gap-4 p-4">
      <Empty
        title="Entry not found"
        hint={query.error ? errorMessage(query.error) : undefined}
      />
      <Button label="Back to audit logs" onPress={() => router.back()} />
    </View>
  );
}

export default function AuditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequirePerm anyOf={["audit:read"]}>
      <AuditDetailLoader id={id} />
    </RequirePerm>
  );
}
