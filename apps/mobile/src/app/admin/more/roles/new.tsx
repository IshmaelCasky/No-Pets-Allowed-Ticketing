import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createRoleSchema } from "@npa/validators";

import type { RoleFormValues } from "~/components/people/role-form";
import { RequirePerm } from "~/components/admin";
import { firstIssue } from "~/components/people/controls";
import { RoleForm } from "~/components/people/role-form";
import { trpc } from "~/utils/api";

const EMPTY: RoleFormValues = { name: "", description: "", permissions: [] };

function CreateRole() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const create = useMutation(
    trpc.role.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.role.list.queryFilter());
        router.back();
      },
      onError: (e) => setError(e.message),
    }),
  );

  const submit = (values: RoleFormValues) => {
    setError(null);
    const parsed = createRoleSchema.safeParse({
      name: values.name,
      description: values.description.trim() || undefined,
      permissions: values.permissions,
    });
    if (!parsed.success) {
      setError(
        firstIssue(parsed.error, { name: "Name", description: "Description" }),
      );
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <RoleForm
      initial={EMPTY}
      submitLabel="Create role"
      submitting={create.isPending}
      error={error}
      onSubmit={submit}
    />
  );
}

export default function NewRoleScreen() {
  return (
    <RequirePerm anyOf={["roles:write"]}>
      <CreateRole />
    </RequirePerm>
  );
}
