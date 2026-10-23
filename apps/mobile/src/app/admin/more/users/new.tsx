import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createStaffSchema } from "@npa/validators";

import { RequirePerm, SectionHeader } from "~/components/admin";
import {
  firstIssue,
  FormError,
  OptionList,
} from "~/components/people/controls";
import { Button, Field, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";

const LABELS = {
  name: "Name",
  email: "Email",
  password: "Temporary password",
  phone: "Phone",
  roleId: "Role",
};

/** Create a staff account with a role (`users:write`). */
function CreateStaffForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const roles = useQuery(trpc.role.list.queryOptions());

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const create = useMutation(
    trpc.user.createStaff.mutationOptions({
      onSuccess: async (user) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.user.list.queryFilter()),
          queryClient.invalidateQueries(trpc.role.list.queryFilter()),
        ]);
        router.replace(`/admin/more/users/${user.id}`);
      },
      onError: (e) => setError(e.message),
    }),
  );

  const submit = () => {
    setError(null);
    const parsed = createStaffSchema.safeParse({
      name,
      email,
      password,
      phone: phone.trim() || undefined,
      roleId: roleId ?? "",
    });
    if (!parsed.success) {
      setError(
        roleId ? firstIssue(parsed.error, LABELS) : "Pick a role for this user",
      );
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView
        contentContainerClassName="p-4 gap-4 pb-28"
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          maxLength={120}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label="Temporary password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="At least 8 characters"
        />
        <Field
          label="Phone (optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={32}
        />
        <SectionHeader title="Role" />
        {roles.isLoading ? (
          <Loading />
        ) : (
          <OptionList
            options={(roles.data ?? []).map((r) => ({
              value: r.id,
              label: r.name,
              hint: `${r.permissions.length} permission${r.permissions.length === 1 ? "" : "s"}`,
            }))}
            value={roleId}
            onChange={setRoleId}
          />
        )}
        <Text className="text-muted-foreground text-xs">
          Share the temporary password with the person securely; they can sign
          in right away.
        </Text>
        <FormError message={error} />
        <Button
          label="Create staff account"
          onPress={submit}
          loading={create.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function NewStaffScreen() {
  return (
    <RequirePerm anyOf={["users:write"]}>
      <CreateStaffForm />
    </RequirePerm>
  );
}
