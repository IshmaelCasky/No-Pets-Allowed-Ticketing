"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { RouterOutputs } from "@npa/api";
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
import { Card, CardContent, CardHeader, CardTitle } from "@npa/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@npa/ui/dialog";
import { Field, FieldError, FieldLabel } from "@npa/ui/field";
import { Input } from "@npa/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@npa/ui/table";
import { toast } from "@npa/ui/toast";

import { formatCentavos, toDatetimeLocal } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { ImageUploadField } from "../../../_components/image-upload-field";

type Tier = RouterOutputs["event"]["tiersByEvent"][number];

interface TierFormValues {
  name: string;
  price: number; // pesos in the form, converted to centavos
  capacity: number;
  salesStartAt?: string;
  salesEndAt?: string;
  imageUrl?: string;
}

function TierDialog({
  eventId,
  tier,
  trigger,
  onDone,
}: {
  eventId: string;
  tier?: Tier;
  trigger: React.ReactNode;
  onDone: () => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const form = useForm<TierFormValues>({
    defaultValues: {
      name: tier?.name ?? "",
      price: tier ? tier.price / 100 : 0,
      capacity: tier?.capacity ?? 100,
      salesStartAt: toDatetimeLocal(tier?.salesStartAt),
      salesEndAt: toDatetimeLocal(tier?.salesEndAt),
      imageUrl: tier?.imageUrl ?? "",
    },
  });
  const imageUrl = form.watch("imageUrl");

  const create = useMutation(
    trpc.event.createTier.mutationOptions({
      onSuccess: () => {
        toast.success("Tier created");
        setOpen(false);
        onDone();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const update = useMutation(
    trpc.event.updateTier.mutationOptions({
      onSuccess: () => {
        toast.success("Tier updated");
        setOpen(false);
        onDone();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const submit = form.handleSubmit((values) => {
    const price = Math.round(Number(values.price) * 100);
    const base = {
      name: values.name,
      price,
      capacity: Number(values.capacity),
      salesStartAt: values.salesStartAt
        ? new Date(values.salesStartAt)
        : undefined,
      salesEndAt: values.salesEndAt ? new Date(values.salesEndAt) : undefined,
      imageUrl: values.imageUrl?.trim() ? values.imageUrl.trim() : undefined,
    };
    if (tier) {
      update.mutate({ id: tier.id, ...base });
    } else {
      create.mutate({ eventId, ...base });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tier ? "Edit tier" : "Add tier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="tname">Name</FieldLabel>
            <Input
              id="tname"
              {...form.register("name", { required: "Required" })}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="tprice">Price (₱)</FieldLabel>
              <Input
                id="tprice"
                type="number"
                step="0.01"
                min={0}
                {...form.register("price", { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tcap">Capacity</FieldLabel>
              <Input
                id="tcap"
                type="number"
                min={1}
                {...form.register("capacity", { valueAsNumber: true })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="tstart">Sales start</FieldLabel>
              <Input
                id="tstart"
                type="datetime-local"
                {...form.register("salesStartAt")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tend">Sales end</FieldLabel>
              <Input
                id="tend"
                type="datetime-local"
                {...form.register("salesEndAt")}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Artwork (optional)</FieldLabel>
            <ImageUploadField
              endpoint="eventPoster"
              fieldId="tier-image"
              value={imageUrl}
              label={imageUrl ? "Replace image" : "Upload image"}
              onUploaded={({ url }) => {
                if (url) form.setValue("imageUrl", url);
              }}
            />
          </Field>
          <Button type="submit" disabled={create.isPending || update.isPending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TierEditor({ eventId }: { eventId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: tiers } = useQuery(
    trpc.event.tiersByEvent.queryOptions({ eventId }),
  );

  const invalidate = () =>
    queryClient.invalidateQueries(
      trpc.event.tiersByEvent.queryFilter({ eventId }),
    );

  const remove = useMutation(
    trpc.event.deleteTier.mutationOptions({
      onSuccess: () => {
        toast.success("Tier deleted");
        void invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Ticket tiers</CardTitle>
        <TierDialog
          eventId={eventId}
          trigger={<Button size="sm">Add tier</Button>}
          onDone={() => void invalidate()}
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16" />
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tiers ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground h-16 text-center"
                >
                  No tiers yet.
                </TableCell>
              </TableRow>
            ) : (
              (tiers ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {t.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.imageUrl}
                        alt={t.name}
                        className="size-10 rounded border object-cover"
                      />
                    ) : (
                      <div className="bg-muted size-10 rounded border" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-right">
                    {formatCentavos(t.price)}
                  </TableCell>
                  <TableCell className="text-right">{t.capacity}</TableCell>
                  <TableCell className="text-right">{t.reserved}</TableCell>
                  <TableCell className="text-right">{t.sold}</TableCell>
                  <TableCell className="text-right">
                    {t.capacity - t.reserved - t.sold}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <TierDialog
                      eventId={eventId}
                      tier={t}
                      trigger={
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      }
                      onDone={() => void invalidate()}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={t.reserved + t.sold > 0}
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete tier?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Only tiers with no reserved or sold tickets can be
                            deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove.mutate({ id: t.id })}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
