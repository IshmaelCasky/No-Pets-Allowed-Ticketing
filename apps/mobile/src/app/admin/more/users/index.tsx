import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import {
  Chips,
  ListFooter,
  ListRow,
  Pill,
  RequirePerm,
  SearchBar,
} from "~/components/admin";
import { HeaderAction, useDebounced } from "~/components/people/controls";
import { Empty, Loading } from "~/components/ui";
import { trpc, trpcClient } from "~/utils/api";
import { formatManilaDate } from "~/utils/format";
import { usePagedList } from "~/utils/use-paged-list";
import { usePermissions } from "~/utils/use-permissions";

type UserPage = RouterOutputs["user"]["list"];
type UserRow = UserPage["items"][number];
type BanFilter = "active" | "banned";

const BAN_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "banned", label: "Banned" },
] as const;

/** User Management list: search, role + status filters, infinite scroll. */
function UsersList() {
  const router = useRouter();
  const { has } = usePermissions();
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim());
  const [roleId, setRoleId] = useState<string | undefined>();
  const [ban, setBan] = useState<BanFilter | undefined>();

  const roles = useQuery(trpc.role.list.queryOptions());
  const roleName = useMemo(() => {
    const map = new Map(roles.data?.map((r) => [r.id, r.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "No role");
  }, [roles.data]);

  const input = {
    pageSize: 30,
    search: search || undefined,
    roleId,
    banned: ban === undefined ? undefined : ban === "banned",
  };
  const list = usePagedList<UserRow, UserPage>(
    [...trpc.user.list.pathKey(), input],
    (page) => trpcClient.user.list.query({ ...input, page }),
  );

  const renderItem = ({ item }: { item: UserRow }) => (
    <ListRow
      title={item.name}
      subtitle={item.email}
      meta={`${roleName(item.roleId)} · joined ${formatManilaDate(item.createdAt)}`}
      right={item.banned ? <Pill label="Banned" tone="red" /> : null}
      onPress={() => router.push(`/admin/more/users/${item.id}`)}
    />
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: has("users:write")
            ? () => (
                <HeaderAction
                  label="+ Staff"
                  onPress={() => router.push("/admin/more/users/new")}
                />
              )
            : undefined,
        }}
      />
      <FlatList
        data={list.items}
        keyExtractor={(u) => u.id}
        renderItem={renderItem}
        contentContainerClassName="p-4 gap-2 pb-24"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-2 pb-2">
            <SearchBar
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search name or email…"
            />
            <Chips
              allLabel="All roles"
              options={(roles.data ?? []).map((r) => ({
                value: r.id,
                label: r.name,
              }))}
              value={roleId}
              onChange={setRoleId}
            />
            <Chips
              allLabel="Any status"
              options={BAN_OPTIONS}
              value={ban}
              onChange={setBan}
            />
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? (
            <Loading />
          ) : list.isError ? (
            <Empty title="Couldn't load users" hint={list.error.message} />
          ) : (
            <Empty
              title="No users found"
              hint="Try another search or filter."
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
        onRefresh={() => {
          void list.refetch();
          void roles.refetch();
        }}
      />
    </>
  );
}

export default function UsersScreen() {
  return (
    <RequirePerm anyOf={["users:read"]}>
      <UsersList />
    </RequirePerm>
  );
}
