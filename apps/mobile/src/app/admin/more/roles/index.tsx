import { FlatList, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { ListRow, Pill, RequirePerm } from "~/components/admin";
import { HeaderAction } from "~/components/people/controls";
import { Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";

type RoleRow = RouterOutputs["role"]["list"][number];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Role Management list: member count, permission count, System pill. */
function RolesList() {
  const router = useRouter();
  const roles = useQuery(trpc.role.list.queryOptions());

  const renderItem = ({ item }: { item: RoleRow }) => (
    <ListRow
      title={item.name}
      subtitle={item.description ?? "No description"}
      meta={`${plural(item.memberCount, "member")} · ${plural(item.permissions.length, "permission")}`}
      right={item.isSystem ? <Pill label="System" tone="purple" /> : null}
      onPress={() => router.push(`/admin/more/roles/${item.id}`)}
    />
  );

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderAction
              label="+ Role"
              onPress={() => router.push("/admin/more/roles/new")}
            />
          ),
        }}
      />
      <FlatList
        data={roles.data ?? []}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerClassName="p-4 gap-2 pb-24"
        ListEmptyComponent={
          roles.isLoading ? (
            <Loading />
          ) : roles.isError ? (
            <Empty title="Couldn't load roles" hint={roles.error.message} />
          ) : (
            <Empty title="No roles yet" />
          )
        }
        refreshing={roles.isRefetching}
        onRefresh={() => void roles.refetch()}
      />
    </View>
  );
}

export default function RolesScreen() {
  return (
    <RequirePerm anyOf={["roles:write"]}>
      <RolesList />
    </RequirePerm>
  );
}
