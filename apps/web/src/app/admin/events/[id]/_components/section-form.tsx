"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { RouterOutputs } from "@npa/api";
import { Button } from "@npa/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";
import { toast } from "@npa/ui/toast";

import { useTRPC } from "~/trpc/react";

type Section = RouterOutputs["seatMap"]["forEvent"]["sections"][number];

interface SectionFormValues {
  name: string;
  price: number; // pesos
  rows: number;
  seatsPerRow: number;
  rowLabelStyle: "alpha" | "numeric";
  color: string;
}

export function SectionForm({
  eventId,
  section,
  trigger,
  onDone,
}: {
  eventId: string;
  section?: Section;
  trigger: React.ReactNode;
  onDone: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<SectionFormValues>({
    defaultValues: {
      name: section?.name ?? "",
      price: section ? section.price / 100 : 0,
      rows: section?.rows ?? 5,
      seatsPerRow: section?.seatsPerRow ?? 10,
      rowLabelStyle: section?.rowLabelStyle ?? "alpha",
      color: section?.color ?? "#6366f1",
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries(
      trpc.seatMap.forEvent.queryFilter({ eventId }),
    );

  const create = useMutation(
    trpc.seatMap.createSection.mutationOptions({
      onSuccess: () => {
        toast.success("Section added");
        setOpen(false);
        void invalidate();
        onDone();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const update = useMutation(
    trpc.seatMap.updateSection.mutationOptions({
      onSuccess: () => {
        toast.success("Section updated");
        setOpen(false);
        void invalidate();
        onDone();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const submit = form.handleSubmit((values) => {
    const price = Math.round(Number(values.price) * 100);
    if (section) {
      // Rows / seatsPerRow can't change after creation (seats already built).
      update.mutate({
        id: section.id,
        name: values.name,
        price,
        rowLabelStyle: values.rowLabelStyle,
        color: values.color,
      });
    } else {
      create.mutate({
        eventId,
        name: values.name,
        price,
        rows: Number(values.rows),
        seatsPerRow: Number(values.seatsPerRow),
        rowLabelStyle: values.rowLabelStyle,
        color: values.color,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{section ? "Edit section" : "Add section"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="sname">Name</FieldLabel>
            <Input
              id="sname"
              placeholder="VIP"
              {...form.register("name", { required: "Required" })}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="sprice">Price (₱)</FieldLabel>
              <Input
                id="sprice"
                type="number"
                step="0.01"
                min={0}
                {...form.register("price", { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="scolor">Color</FieldLabel>
              <Input id="scolor" type="color" {...form.register("color")} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel htmlFor="srows">Rows</FieldLabel>
              <Input
                id="srows"
                type="number"
                min={1}
                max={100}
                disabled={!!section}
                {...form.register("rows", { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sspr">Seats / row</FieldLabel>
              <Input
                id="sspr"
                type="number"
                min={1}
                max={100}
                disabled={!!section}
                {...form.register("seatsPerRow", { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel>Row labels</FieldLabel>
              <Select
                value={form.watch("rowLabelStyle")}
                onValueChange={(v) =>
                  form.setValue("rowLabelStyle", v as "alpha" | "numeric")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alpha">A, B, C…</SelectItem>
                  <SelectItem value="numeric">1, 2, 3…</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {section && (
            <p className="text-muted-foreground text-xs">
              Rows and seats per row are fixed once a section is created.
            </p>
          )}
          <Button type="submit" disabled={create.isPending || update.isPending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
