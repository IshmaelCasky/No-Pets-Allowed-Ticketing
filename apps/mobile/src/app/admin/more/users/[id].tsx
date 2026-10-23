import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignUserRoleSchema,
  banUserSchema,
  resetUserPasswordSchema,
} from "@npa/validators";

import type { RouterOutputs } from "~/utils/api";
import { KeyValue, Pill, RequirePerm, SectionHeader } from "~/components/admin";
import {
  ActionPanel,
  firstIssue,
  FormError,
  OptionList,
} from "~/components/people/controls";
import { TICKET_TONE, titleCase } from "~/components/people/labels";
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  StatusBadge,
} from "~/components/ui";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { confirm, showError } from "~/utils/feedback";
import { formatCentavos, formatManila, formatManilaDate } from "~/utils/format";
import { usePermissions } from "~/utils/use-permissions";

type UserDetail = NonNullable<RouterOutputs["user"]["byId"]>;
type Panel = "role" | "password" | "ban" | null;

function useInvalidateUser(userId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries(trpc.user.byId.queryFilter({ id: userId })),
      queryClient.invalidateQueries(trpc.user.list.pathFilter()),
      queryClient.invalidateQueries(trpc.role.list.queryFilter()),
    ]);
}

/* ---------------------------- Assign role ------------------------------ */
function AssignRole({
  user,
  onDone,
}: {
  user: UserDetail;
  onDone: () => void;
}) {
  const roles = useQuery(trpc.role.list.queryOptions());
  const [roleId, setRoleId] = useState(user.roleId ?? undefined);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateUser(user.id);

  const assign = useMutation(
    trpc.user.assignRole.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        onDone();
      },
      // e.g. FORBIDDEN "Cannot demote the last Super Admin"
      onError: (e) => showError(e, "Couldn't change role"),
    }),
  );

  const save = () => {
    setError(null);
    const parsed = assignUserRoleSchema.safeParse({
      userId: user.id,
      roleId: roleId ?? "",
    });
    if (!parsed.success) {
      setError("Pick a role");
      return;
    }
    const target = roles.data?.find((r) => r.id === parsed.data.roleId);
    confirm({
      title: "Change role?",
      message: `${user.name} will become ${target?.name ?? "this role"} and get its permissions right away.`,
      confirmLabel: "Change role",
      onConfirm: () => assign.mutate(parsed.data),
    });
  };

  if (roles.isLoading) return <Loading />;
  return (
    <>
      <OptionList
        options={(roles.data ?? []).map((r) => ({
          value: r.id,
          label: r.name,
          hint: r.description,
        }))}
        value={roleId}
        onChange={setRoleId}
      />
      <FormError message={error} />
      <Button
        label="Save role"
        onPress={save}
        loading={assign.isPending}
        disabled={roleId === (user.roleId ?? undefined)}
      />
    </>
  );
}

/* --------------------------- Reset password ---------------------------- */
function ResetPassword({
  user,
  onDone,
}: {
  user: UserDetail;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reset = useMutation(
    trpc.user.resetPassword.mutationOptions({
      onSuccess: () => {
        setPassword("");
        onDone();
      },
      onError: (e) => showError(e, "Couldn't reset password"),
    }),
  );

  const save = () => {
    setError(null);
    const parsed = resetUserPasswordSchema.safeParse({
      userId: user.id,
      password,
    });
    if (!parsed.success) {
      setError(firstIssue(parsed.error, { password: "Password" }));
      return;
    }
    confirm({
      title: "Reset password?",
      message: `${user.name}'s password will be replaced. Share the new one with them securely.`,
      confirmLabel: "Reset",
      destructive: true,
      onConfirm: () => reset.mutate(parsed.data),
    });
  };

  return (
    <>
      <Field
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="At least 8 characters"
      />
      <FormError message={error} />
      <Button label="Reset password" onPress={save} loading={reset.isPending} />
    </>
  );
}

/* -------------------------------- Ban ---------------------------------- */
function BanUser({ user, onDone }: { user: UserDetail; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateUser(user.id);
  const ban = useMutation(
    trpc.user.ban.mutationOptions({
      onSuccess: async () => {
        setReason("");
        await invalidate();
        onDone();
      },
      onError: (e) => showError(e, "Couldn't ban user"),
    }),
  );

  const save = () => {
    setError(null);
    const parsed = banUserSchema.safeParse({ userId: user.id, reason });
    if (!parsed.success) {
      setError(firstIssue(parsed.error));
      return;
    }
    confirm({
      title: `Ban ${user.name}?`,
      message: "Banned users can't sign in.",
      confirmLabel: "Ban",
      destructive: true,
      onConfirm: () => ban.mutate(parsed.data),
    });
  };

  return (
    <>
      <Field
        label="Reason (required)"
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={3}
        maxLength={1000}
        placeholder="Why is this account being banned?"
      />
      <FormError message={error} />
      <Button
        label="Ban user"
        variant="destructive"
        onPress={save}
        loading={ban.isPending}
      />
    </>
  );
}

/* ------------------------------ Screen --------------------------------- */
function UserDetailView({ id }: { id: string }) {
  const { has } = usePermissions();
  const { data: session } = authClient.useSession();
  const isSelf = session?.user.id === id;
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Exclude<Panel, null>) =>
    setPanel((cur) => (cur === p ? null : p));

  const userQ = useQuery(trpc.user.byId.queryOptions({ id }));
  const roles = useQuery(trpc.role.list.queryOptions());
  const invalidate = useInvalidateUser(id);

  const unban = useMutation(
    trpc.user.unban.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (e) => showError(e, "Couldn't unban user"),
    }),
  );

  if (userQ.isLoading) return <Loading />;
  if (userQ.isError) {
    return <Empty title="Couldn't load user" hint={userQ.error.message} />;
  }
  const user = userQ.data;
  if (!user) return <Empty title="User not found" />;

  const role = roles.data?.find((r) => r.id === user.roleId);
  const canWrite = has("users:write");
  const canBan = has("users:ban");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <Stack.Screen options={{ title: user.name }} />
      <ScrollView
        contentContainerClassName="p-4 gap-3 pb-28"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={userQ.isRefetching}
            onRefresh={() => {
              void userQ.refetch();
              void roles.refetch();
            }}
          />
        }
      >
        <Card className="gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="text-foreground flex-1 text-xl font-bold">
              {user.name}
            </Text>
            {user.banned ? (
              <Pill label="Banned" tone="red" />
            ) : (
              <Pill label="Active" tone="green" />
            )}
          </View>
          <Text className="text-muted-foreground" selectable>
            {user.email}
          </Text>
          <View className="pt-2">
            <KeyValue label="Role" value={role?.name ?? "No role"} />
            <KeyValue label="Phone" value={user.phone ?? "—"} />
            <KeyValue label="Joined" value={formatManilaDate(user.createdAt)} />
            {user.banned && user.banReason ? (
              <KeyValue label="Ban reason" value={user.banReason} />
            ) : null}
          </View>
        </Card>

        {canWrite || canBan ? <SectionHeader title="Actions" /> : null}
        {isSelf && (canWrite || canBan) ? (
          <Text className="text-muted-foreground text-xs">
            This is your account — you can't change your own role or ban
            yourself.
          </Text>
        ) : null}

        {canWrite && !isSelf ? (
          <ActionPanel
            title="Assign role"
            subtitle={role ? `Currently ${role.name}` : "No role yet"}
            open={panel === "role"}
            onToggle={() => toggle("role")}
          >
            <AssignRole user={user} onDone={() => setPanel(null)} />
          </ActionPanel>
        ) : null}

        {canWrite ? (
          <ActionPanel
            title="Reset password"
            subtitle="Set a new password for this account"
            open={panel === "password"}
            onToggle={() => toggle("password")}
          >
            <ResetPassword
              user={user}
              onDone={() => {
                setPanel(null);
                Alert.alert(
                  "Password reset",
                  `Let ${user.name} know their new password.`,
                );
              }}
            />
          </ActionPanel>
        ) : null}

        {canBan && user.banned ? (
          <Button
            label="Unban user"
            variant="outline"
            loading={unban.isPending}
            onPress={() =>
              confirm({
                title: `Unban ${user.name}?`,
                message: "They'll be able to sign in again.",
                confirmLabel: "Unban",
                onConfirm: () => unban.mutate({ userId: user.id }),
              })
            }
          />
        ) : null}
        {canBan && !user.banned && !isSelf ? (
          <ActionPanel
            title="Ban user"
            subtitle="Block this account from signing in"
            destructive
            open={panel === "ban"}
            onToggle={() => toggle("ban")}
          >
            <BanUser user={user} onDone={() => setPanel(null)} />
          </ActionPanel>
        ) : null}

        <SectionHeader title={`Orders (${user.orders.length})`} />
        {user.orders.length === 0 ? (
          <Text className="text-muted-foreground text-sm">No orders.</Text>
        ) : (
          user.orders.map((o) => (
            <Card key={o.id} className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text
                  className="text-foreground font-mono text-base font-semibold"
                  selectable
                >
                  {o.code}
                </Text>
                <StatusBadge status={o.status} />
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted-foreground text-sm">
                  {formatManila(o.createdAt)}
                </Text>
                <Text className="text-foreground text-sm font-semibold">
                  {formatCentavos(o.totalAmount)}
                </Text>
              </View>
            </Card>
          ))
        )}

        <SectionHeader title={`Tickets (${user.tickets.length})`} />
        {user.tickets.length === 0 ? (
          <Text className="text-muted-foreground text-sm">No tickets.</Text>
        ) : (
          user.tickets.map((t) => {
            const order = user.orders.find((o) => o.id === t.orderId);
            return (
              <Card key={t.id} className="gap-1">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-foreground flex-1 text-base font-semibold">
                    {t.holderName ?? user.name}
                  </Text>
                  <Pill
                    label={titleCase(t.status)}
                    tone={TICKET_TONE[t.status]}
                  />
                </View>
                <Text className="text-muted-foreground text-sm">
                  {order ? `Order ${order.code}` : "Order —"}
                  {t.usedAt ? ` · checked in ${formatManila(t.usedAt)}` : ""}
                </Text>
              </Card>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequirePerm anyOf={["users:read"]}>
      <UserDetailView id={id} />
    </RequirePerm>
  );
}
