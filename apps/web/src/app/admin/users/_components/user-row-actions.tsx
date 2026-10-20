"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import type { RouterOutputs } from "@npa/api";
import { Button } from "@npa/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@npa/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@npa/ui/dropdown-menu";
import { Field, FieldError } from "@npa/ui/field";
import { Input } from "@npa/ui/input";
import { Label } from "@npa/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";
import { Textarea } from "@npa/ui/textarea";
import { toast } from "@npa/ui/toast";
import {
  assignUserRoleSchema,
  banUserSchema,
  resetUserPasswordSchema,
} from "@npa/validators";

import { useTRPC } from "~/trpc/react";

type UserRow = RouterOutputs["user"]["list"]["items"][number];

type OpenDialog = "assign" | "ban" | "reset" | null;

export function UserRowActions({
  user,
  currentUserId,
}: {
  user: UserRow;
  currentUserId: string;
}) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isSelf = user.id === currentUserId;

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.user.list.queryFilter());

  const unbanMutation = useMutation(
    trpc.user.unban.mutationOptions({
      onSuccess: async () => {
        toast.success("User unbanned");
        await invalidate();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <span aria-hidden className="text-lg leading-none">
              ⋯
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${user.id}`}>View details</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isSelf}
            onSelect={() => setDialog("assign")}
          >
            Assign role
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("reset")}>
            Reset password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.banned ? (
            <DropdownMenuItem
              onSelect={() => unbanMutation.mutate({ userId: user.id })}
            >
              Unban
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={isSelf}
              onSelect={() => setDialog("ban")}
            >
              Ban
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AssignRoleDialog
        open={dialog === "assign"}
        onClose={() => setDialog(null)}
        user={user}
        onDone={invalidate}
      />
      <BanDialog
        open={dialog === "ban"}
        onClose={() => setDialog(null)}
        user={user}
        onDone={invalidate}
      />
      <ResetPasswordDialog
        open={dialog === "reset"}
        onClose={() => setDialog(null)}
        user={user}
      />
    </>
  );
}

function AssignRoleDialog({
  open,
  onClose,
  user,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow;
  onDone: () => Promise<unknown>;
}) {
  const trpc = useTRPC();
  const { data: roles } = useQuery(trpc.role.list.queryOptions());
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(assignUserRoleSchema),
    defaultValues: { userId: user.id, roleId: user.roleId ?? "" },
  });

  const mutation = useMutation(
    trpc.user.assignRole.mutationOptions({
      onSuccess: async () => {
        toast.success("Role assigned");
        await onDone();
        onClose();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign role</DialogTitle>
          <DialogDescription>
            Change the role for {user.name}.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4"
        >
          <Field>
            <Label>Role</Label>
            <Controller
              control={control}
              name="roleId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[formState.errors.roleId]} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BanDialog({
  open,
  onClose,
  user,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow;
  onDone: () => Promise<unknown>;
}) {
  const trpc = useTRPC();
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(banUserSchema),
    defaultValues: { userId: user.id, reason: "" },
  });

  const mutation = useMutation(
    trpc.user.ban.mutationOptions({
      onSuccess: async () => {
        toast.success("User banned");
        await onDone();
        onClose();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {user.name}</DialogTitle>
          <DialogDescription>
            Banned users cannot sign in. A reason is required.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4"
        >
          <Field>
            <Label htmlFor="ban-reason">Reason</Label>
            <Textarea id="ban-reason" {...register("reason")} />
            <FieldError errors={[formState.errors.reason]} />
          </Field>
          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Banning…" : "Ban user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow;
}) {
  const trpc = useTRPC();
  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(resetUserPasswordSchema),
    defaultValues: { userId: user.id, password: "" },
  });

  const mutation = useMutation(
    trpc.user.resetPassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password reset");
        reset();
        onClose();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.name}.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4"
        >
          <Field>
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              {...register("password")}
            />
            <FieldError errors={[formState.errors.password]} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Reset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
