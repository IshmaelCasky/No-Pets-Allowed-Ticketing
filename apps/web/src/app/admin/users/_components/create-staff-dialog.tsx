"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import type { CreateStaffInput } from "@npa/validators";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";
import { toast } from "@npa/ui/toast";
import { createStaffSchema } from "@npa/validators";

import { useTRPC } from "~/trpc/react";

export function CreateStaffDialog() {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: roles } = useQuery(trpc.role.list.queryOptions());

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema as never),
    defaultValues: { name: "", email: "", password: "", phone: "", roleId: "" },
  });

  const mutation = useMutation(
    trpc.user.createStaff.mutationOptions({
      onSuccess: async () => {
        toast.success("Staff user created");
        await queryClient.invalidateQueries(trpc.user.list.queryFilter());
        setOpen(false);
        reset();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create staff</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create staff user</DialogTitle>
          <DialogDescription>
            Create an account and assign it a role.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4"
        >
          <Field>
            <Label htmlFor="staff-name">Name</Label>
            <Input id="staff-name" {...register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field>
            <Label htmlFor="staff-email">Email</Label>
            <Input id="staff-email" type="email" {...register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field>
            <Label htmlFor="staff-password">Temporary password</Label>
            <Input
              id="staff-password"
              type="password"
              {...register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>
          <Field>
            <Label htmlFor="staff-phone">Phone (optional)</Label>
            <Input id="staff-phone" {...register("phone")} />
            <FieldError errors={[errors.phone]} />
          </Field>
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
            <FieldError errors={[errors.roleId]} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
