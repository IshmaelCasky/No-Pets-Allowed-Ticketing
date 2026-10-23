import { useState } from "react";
import { Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { updateRoleSchema } from "@npa/validators";

import type { RoleFormValues } from "~/components/people/role-form";
import { RequirePerm, SectionHeader } from "~/components/admin";
import { firstIssue } from "~/components/people/controls";
import { RoleForm } from "~/components/people/role-form";
import { Button, Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { confirm, showError } from "~/utils/feedback";

/** Edit a role. System roles are read-only and can't be deleted (as on web). */
function EditRole({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const roles = useQuery(trpc.role.list.queryOptions());
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.role.list.queryFilter());

  const update = useMutation(
    trpc.role.update.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        router.back();
      },
      onError: (e) => setError(e.message),
    }),
  );
  const remove = useMutation(
    trpc.role.delete.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        router.back();
      },
      onError: (e) => showError(e, "Couldn't delete role"),
    }),
  );

  if (roles.isLoading) return <Loading />;
  if (roles.isError) {
    return <Empty title="Couldn't load role" hint={roles.error.message} />;
  }
  const role = roles.data?.find((r) => r.id === id);
  if (!role) return <Empty title="Role not found" />;

  const submit = (values: RoleFormValues) => {
    setError(null);
    const parsed = updateRoleSchema.safeParse({
      id: role.id,
      name: values.name,
      description: values.description,
      permissions: values.permissions,
    });
    if (!parsed.success) {
      setError(
        firstIssue(parsed.error, { name: "Name", description: "Description" }),
      );
      return;
    }
    update.mutate(parsed.data);
  };

  const canDelete = !role.isSystem && role.memberCount === 0;
  const deleteHint = role.isSystem
    ? null
    : role.memberCount > 0
      ? `Reassign its ${role.memberCount} member${role.memberCount === 1 ? "" : "s"} before deleting this role.`
      : "This can't be undone.";

  return (
    <>
      <Stack.Screen options={{ title: role.name }} />
      <RoleForm
        // Re-mount with fresh values if the cached role changes.
        key={`${role.id}:${role.name}:${role.permissions.join(",")}`}
        initial={{
          name: role.name,
          description: role.description ?? "",
          permissions: role.permissions,
        }}
        locked={role.isSystem}
        submitLabel="Save changes"
        submitting={update.isPending}
        error={error}
        onSubmit={submit}
        footer={
          role.isSystem ? null : (
            <View className="gap-2 pt-4">
              <SectionHeader title="Danger zone" />
              <Button
                label="Delete role"
                variant="destructive"
                disabled={!canDelete}
                loading={remove.isPending}
                onPress={() =>
                  confirm({
                    title: `Delete ${role.name}?`,
                    message: "This cannot be undone.",
                    confirmLabel: "Delete",
                    destructive: true,
                    onConfirm: () => remove.mutate({ id: role.id }),
                  })
                }
              />
              {deleteHint ? (
                <Text className="text-muted-foreground text-xs">
                  {deleteHint}
                </Text>
              ) : null}
            </View>
          )
        }
      />
    </>
  );
}

export default function RoleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequirePerm anyOf={["roles:write"]}>
      <EditRole id={id} />
    </RequirePerm>
  );
}
