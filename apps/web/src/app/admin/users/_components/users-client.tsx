"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "@npa/api";
import type { DataTableColumn } from "@npa/ui/data-table";
import { Badge } from "@npa/ui/badge";
import { DataTable } from "@npa/ui/data-table";
import { Input } from "@npa/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";

import { formatManilaDate } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { useListParams } from "../../_lib/use-list-params";
import { CreateStaffDialog } from "./create-staff-dialog";
import { UserRowActions } from "./user-row-actions";

type UserRow = RouterOutputs["user"]["list"]["items"][number];

const PAGE_SIZE = 20;
const ALL = "__all__";

export function UsersClient() {
  const trpc = useTRPC();
  const { get, page, setParams, setPage } = useListParams();

  const search = get("search");
  const roleId = get("roleId");
  const banned = get("banned");

  // Debounce the free-text search before writing it to the URL. Local input is
  // the source of truth; we only push the debounced value up to the URL.
  const [searchInput, setSearchInput] = useState(search);
  const latestSearch = useRef(search);
  useEffect(() => {
    latestSearch.current = search;
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== latestSearch.current)
        setParams({ search: searchInput });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, setParams]);

  const { data: roles } = useQuery(trpc.role.list.queryOptions());
  const { data: me } = useQuery(trpc.auth.me.queryOptions());
  const roleName = useMemo(() => {
    const map = new Map(roles?.map((r) => [r.id, r.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [roles]);

  const { data, isLoading } = useQuery(
    trpc.user.list.queryOptions({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      roleId: roleId || undefined,
      banned: banned === "" ? undefined : banned === "true",
    }),
  );

  const columns: DataTableColumn<UserRow>[] = [
    { id: "name", header: "Name", cell: (u) => u.name },
    { id: "email", header: "Email", cell: (u) => u.email },
    { id: "role", header: "Role", cell: (u) => roleName(u.roleId) },
    {
      id: "status",
      header: "Status",
      cell: (u) =>
        u.banned ? (
          <Badge variant="destructive">Banned</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        ),
    },
    {
      id: "created",
      header: "Joined",
      cell: (u) => formatManilaDate(u.createdAt),
    },
    {
      id: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (u) => (
        <UserRowActions user={u} currentUserId={me?.user.id ?? ""} />
      ),
    },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search name or email…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="max-w-xs"
      />
      <Select
        value={roleId || ALL}
        onValueChange={(v) => setParams({ roleId: v === ALL ? "" : v })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All roles</SelectItem>
          {roles?.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={banned || ALL}
        onValueChange={(v) => setParams({ banned: v === ALL ? "" : v })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          <SelectItem value="false">Active</SelectItem>
          <SelectItem value="true">Banned</SelectItem>
        </SelectContent>
      </Select>
      <div className="ml-auto">
        <CreateStaffDialog />
      </div>
    </div>
  );

  return (
    <DataTable
      columns={columns}
      rows={data?.items ?? []}
      rowKey={(u) => u.id}
      total={data?.total ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      isLoading={isLoading}
      toolbar={toolbar}
      emptyMessage="No users found."
    />
  );
}
