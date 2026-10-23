"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";

import type { PermissionKey } from "@npa/validators";
import { Button } from "@npa/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@npa/ui/dialog";
import { Field, FieldError } from "@npa/ui/field";
import { Input } from "@npa/ui/input";
import { Label } from "@npa/ui/label";
import { Textarea } from "@npa/ui/textarea";
import { toast } from "@npa/ui/toast";
import { createRoleSchema } from "@npa/validators";

import { useTRPC } from "~/trpc/react";
import { PermissionChecklist } from "./permission-checklist";

interface FormValues {
  name: string;
  description?: string;
  permissions: PermissionKey[];
}

interface RoleFormDialogProps {
  mode: "create" | "edit";
  trigger: React.ReactNode;
  initial?: {
    id: string;
    name: string;
    description: string | null;
    permissions: PermissionKey[];
  };
}

export function RoleFormDialog({
  mode,
  trigger,
  initial,
}: RoleFormDialogProps) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    // zodResolver's v3 typings don't line up with our zod/v4 schemas; safe at
    // runtime. See "Contract changes requested" in the admin-web report.
    resolver: zodResolver(createRoleSchema as never),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      permissions: initial?.permissions ?? [],
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.role.list.queryFilter());

  const createMutation = useMutation(
    trpc.role.create.mutationOptions({
      onSuccess: async () => {
        toast.success("Role created");
        await invalidate();
        setOpen(false);
        reset();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    trpc.role.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Role updated");
        await invalidate();
        setOpen(false);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const pending = createMutation.isPending || updateMutation.isPending;
  const permissions = useWatch({ control, name: "permissions" });

  const onSubmit = handleSubmit((values) => {
    if (mode === "create") {
      createMutation.mutate(values);
    } else if (initial) {
      updateMutation.mutate({ id: initial.id, ...values });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && initial) {
          reset({
            name: initial.name,
            description: initial.description ?? "",
            permissions: initial.permissions,
          });
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {/* Header and Save stay put; the long permission list scrolls between. */}
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pr-12 pb-4">
          <DialogTitle>
            {mode === "create" ? "Create role" : "Edit role"}
          </DialogTitle>
          <DialogDescription>
            Choose the permissions this role grants.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <Field>
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" {...register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field>
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                rows={2}
                {...register("description")}
              />
              <FieldError errors={[errors.description]} />
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <Label>Permissions</Label>
                <span className="text-muted-foreground text-xs">
                  {permissions.length} selected
                </span>
              </div>
              <PermissionChecklist
                value={permissions}
                onChange={(next) =>
                  setValue("permissions", next, { shouldDirty: true })
                }
              />
            </Field>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
