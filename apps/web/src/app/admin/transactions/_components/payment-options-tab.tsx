"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { RouterOutputs } from "@npa/api";
import type { CreatePaymentMethodInput } from "@npa/validators";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@npa/ui/alert-dialog";
import { Button } from "@npa/ui/button";
import { Card, CardContent } from "@npa/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@npa/ui/dialog";
import { Field, FieldError } from "@npa/ui/field";
import { Input } from "@npa/ui/input";
import { Label } from "@npa/ui/label";
import { Switch } from "@npa/ui/switch";
import { Textarea } from "@npa/ui/textarea";
import { toast } from "@npa/ui/toast";
import { createPaymentMethodSchema } from "@npa/validators";

import { ImageUploadField } from "~/app/admin/_components/image-upload-field";
import { useTRPC } from "~/trpc/react";

type PaymentMethod = RouterOutputs["paymentMethod"]["listAll"][number];

export function PaymentOptionsTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    trpc.paymentMethod.listAll.queryOptions(),
  );

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.paymentMethod.listAll.queryFilter());

  const methods = data ?? [];

  const reorder = useMutation(
    trpc.paymentMethod.reorder.mutationOptions({
      onSuccess: () => invalidate(),
      onError: (err) => toast.error(err.message),
    }),
  );

  const move = (index: number, dir: -1 | 1) => {
    const next = [...methods];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    reorder.mutate({ orderedIds: next.map((m) => m.id) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PaymentMethodDialog onDone={invalidate} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-12 text-center">Loading…</p>
      ) : methods.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No payment methods yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {methods.map((method, i) => (
            <PaymentMethodRow
              key={method.id}
              method={method}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              disableUp={i === 0}
              disableDown={i === methods.length - 1}
              onDone={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentMethodRow({
  method,
  onUp,
  onDown,
  disableUp,
  disableDown,
  onDone,
}: {
  method: PaymentMethod;
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
  onDone: () => Promise<void>;
}) {
  const trpc = useTRPC();

  const toggle = useMutation(
    trpc.paymentMethod.update.mutationOptions({
      onSuccess: () => onDone(),
      onError: (err) => toast.error(err.message),
    }),
  );

  const remove = useMutation(
    trpc.paymentMethod.delete.mutationOptions({
      onSuccess: async () => {
        toast.success("Payment method deleted");
        await onDone();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        {method.qrImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={method.qrImageUrl}
            alt={`${method.label} QR`}
            className="size-16 rounded-md border object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-md text-xs">
            No QR
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{method.label}</p>
          <p className="text-muted-foreground text-sm">
            {method.accountName} · {method.accountNumber}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs" htmlFor={`active-${method.id}`}>
            Active
          </Label>
          <Switch
            id={`active-${method.id}`}
            checked={method.isActive}
            disabled={toggle.isPending}
            onCheckedChange={(checked) =>
              toggle.mutate({ id: method.id, isActive: checked })
            }
          />
        </div>

        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="icon"
            disabled={disableUp}
            onClick={onUp}
            aria-label="Move up"
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={disableDown}
            onClick={onDown}
            aria-label="Move down"
          >
            ↓
          </Button>
        </div>

        <PaymentMethodDialog method={method} onDone={onDone} />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {method.label}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the payment method. Existing orders keep their
                recorded reference.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  remove.mutate({ id: method.id });
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function PaymentMethodDialog({
  method,
  onDone,
}: {
  method?: PaymentMethod;
  onDone: () => Promise<void>;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const editing = !!method;

  const form = useForm<CreatePaymentMethodInput>({
    // zodResolver's v3 typings don't line up with our zod/v4 schemas; safe at
    // runtime and the form value type is pinned by the generic above.
    resolver: zodResolver(createPaymentMethodSchema as never),
    defaultValues: {
      label: method?.label ?? "",
      accountName: method?.accountName ?? "",
      accountNumber: method?.accountNumber ?? "",
      qrImageUrl: method?.qrImageUrl ?? undefined,
      instructions: method?.instructions ?? undefined,
      isActive: method?.isActive ?? true,
      sortOrder: method?.sortOrder ?? 0,
    },
  });

  const create = useMutation(
    trpc.paymentMethod.create.mutationOptions({
      onSuccess: async () => {
        toast.success("Payment method added");
        setOpen(false);
        form.reset();
        await onDone();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const update = useMutation(
    trpc.paymentMethod.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Payment method updated");
        setOpen(false);
        await onDone();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const isPending = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit((values) => {
    if (method) {
      update.mutate({ id: method.id, ...values });
    } else {
      create.mutate(values);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={editing ? "outline" : "default"}
          size={editing ? "sm" : "default"}
        >
          {editing ? "Edit" : "Add method"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit payment method" : "Add payment method"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="pm-label">Label</Label>
            <Input
              id="pm-label"
              {...form.register("label")}
              placeholder="GCash"
            />
            <FieldError errors={[form.formState.errors.label]} />
          </Field>
          <Field>
            <Label htmlFor="pm-account-name">Account name</Label>
            <Input id="pm-account-name" {...form.register("accountName")} />
            <FieldError errors={[form.formState.errors.accountName]} />
          </Field>
          <Field>
            <Label htmlFor="pm-account-number">Account number</Label>
            <Input id="pm-account-number" {...form.register("accountNumber")} />
            <FieldError errors={[form.formState.errors.accountNumber]} />
          </Field>
          <Field>
            <Label htmlFor="pm-instructions">Instructions (optional)</Label>
            <Textarea id="pm-instructions" {...form.register("instructions")} />
          </Field>
          <Field>
            <Label>QR image</Label>
            <ImageUploadField
              endpoint="paymentQr"
              value={form.watch("qrImageUrl")}
              label="Upload QR"
              onUploaded={({ url }) => {
                if (url) form.setValue("qrImageUrl", url);
              }}
            />
          </Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : editing ? "Save changes" : "Add method"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
