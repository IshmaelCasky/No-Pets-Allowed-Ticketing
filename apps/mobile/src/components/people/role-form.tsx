import type { ReactNode } from "react";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";

import type { PermissionKey } from "@npa/validators";

import { SectionHeader } from "~/components/admin";
import { Button, Card, Field } from "~/components/ui";
import { FormError } from "./controls";
import { PermissionChecklist } from "./permission-checklist";

export interface RoleFormValues {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

/**
 * Name / description / grouped permission checklist. Validation is done by the
 * caller with the shared Zod schema (`createRoleSchema` / `updateRoleSchema`).
 * `locked` renders the role read-only (system roles), like the web.
 */
export function RoleForm({
  initial,
  locked,
  submitLabel,
  submitting,
  error,
  onSubmit,
  footer,
}: {
  initial: RoleFormValues;
  locked?: boolean;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: RoleFormValues) => void;
  footer?: ReactNode;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    initial.permissions,
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView
        contentContainerClassName="p-4 gap-4 pb-28"
        keyboardShouldPersistTaps="handled"
      >
        {locked ? (
          <Card>
            <Text className="text-foreground font-semibold">
              System role — locked
            </Text>
            <Text className="text-muted-foreground text-sm">
              System roles can't be edited or deleted.
            </Text>
          </Card>
        ) : null}
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          editable={!locked}
          placeholder="e.g. Door Staff"
          maxLength={60}
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          editable={!locked}
          multiline
          numberOfLines={3}
          placeholder="What this role is for"
          maxLength={500}
        />
        <SectionHeader title={`Permissions (${permissions.length})`} />
        <PermissionChecklist
          value={permissions}
          onChange={setPermissions}
          disabled={locked}
        />
        <FormError message={error} />
        {locked ? null : (
          <Button
            label={submitLabel}
            loading={submitting}
            onPress={() => onSubmit({ name, description, permissions })}
          />
        )}
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
