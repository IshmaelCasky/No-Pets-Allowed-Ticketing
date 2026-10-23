"use client";

import { useForm } from "react-hook-form";

import type { RouterOutputs } from "@npa/api";
import { Button } from "@npa/ui/button";
import { Field, FieldError, FieldLabel } from "@npa/ui/field";
import { Input } from "@npa/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";
import { Textarea } from "@npa/ui/textarea";
import { createEventSchema } from "@npa/validators";

import { toDatetimeLocal } from "~/lib/format";
import { ImageUploadField } from "../../_components/image-upload-field";

type Event = RouterOutputs["event"]["byId"];

/** Treat a blank/whitespace string as "not provided". */
function blankToUndefined(value: string | undefined): string | undefined {
  return value && value.trim() !== "" ? value : undefined;
}

/** Form value shape — dates as datetime-local strings, coerced on submit. */
interface EventFormValues {
  title: string;
  slug: string;
  venue: string;
  startsAt: string;
  doorsOpenAt?: string;
  lineup?: string;
  description?: string;
  posterUrl?: string;
  seatingMode: "ga" | "reserved";
  maxPerOrder: number;
  refundCutoffDays: number;
}

export function EventForm({
  event,
  seatingModeLocked,
  onSubmit,
  isPending,
}: {
  event?: NonNullable<Event>;
  /** Locked once any order exists for the event. */
  seatingModeLocked?: boolean;
  onSubmit: (values: {
    title: string;
    slug: string;
    venue: string;
    startsAt: Date;
    doorsOpenAt?: Date;
    lineup?: string;
    description?: string;
    posterUrl?: string;
    seatingMode: "ga" | "reserved";
    maxPerOrder: number;
    refundCutoffDays: number;
  }) => void;
  isPending: boolean;
}) {
  const form = useForm<EventFormValues>({
    defaultValues: {
      title: event?.title ?? "",
      slug: event?.slug ?? "",
      venue: event?.venue ?? "",
      startsAt: toDatetimeLocal(event?.startsAt),
      doorsOpenAt: toDatetimeLocal(event?.doorsOpenAt),
      lineup: event?.lineup ?? "",
      description: event?.description ?? "",
      posterUrl: event?.posterUrl ?? "",
      seatingMode: event?.seatingMode ?? "ga",
      maxPerOrder: event?.maxPerOrder ?? 4,
      refundCutoffDays: event?.refundCutoffDays ?? 7,
    },
  });

  const submit = form.handleSubmit((values) => {
    const parsed = createEventSchema.safeParse({
      title: values.title,
      slug: values.slug,
      venue: values.venue,
      startsAt: new Date(values.startsAt),
      doorsOpenAt: values.doorsOpenAt
        ? new Date(values.doorsOpenAt)
        : undefined,
      lineup: blankToUndefined(values.lineup),
      description: blankToUndefined(values.description),
      posterUrl: blankToUndefined(values.posterUrl),
      seatingMode: values.seatingMode,
      maxPerOrder: Number(values.maxPerOrder),
      refundCutoffDays: Number(values.refundCutoffDays),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      if (first) {
        form.setError(first.path[0] as keyof EventFormValues, {
          message: first.message,
        });
      }
      return;
    }
    onSubmit(parsed.data);
  });

  const posterUrl = form.watch("posterUrl");

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="title">Title</FieldLabel>
        <Input id="title" {...form.register("title")} />
        <FieldError errors={[form.formState.errors.title]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="slug">Slug</FieldLabel>
        <Input
          id="slug"
          placeholder="my-concert-2026"
          {...form.register("slug")}
        />
        <FieldError errors={[form.formState.errors.slug]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="venue">Venue</FieldLabel>
        <Input id="venue" {...form.register("venue")} />
        <FieldError errors={[form.formState.errors.venue]} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="startsAt">Starts at</FieldLabel>
          <Input
            id="startsAt"
            type="datetime-local"
            {...form.register("startsAt")}
          />
          <FieldError errors={[form.formState.errors.startsAt]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="doorsOpenAt">Doors open at</FieldLabel>
          <Input
            id="doorsOpenAt"
            type="datetime-local"
            {...form.register("doorsOpenAt")}
          />
          <FieldError errors={[form.formState.errors.doorsOpenAt]} />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="lineup">Lineup</FieldLabel>
        <Input id="lineup" {...form.register("lineup")} />
      </Field>

      <Field>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea id="description" {...form.register("description")} />
      </Field>

      <Field>
        <FieldLabel>Poster</FieldLabel>
        <ImageUploadField
          endpoint="eventPoster"
          value={posterUrl}
          label="Upload poster"
          onUploaded={({ url }) => {
            if (url) form.setValue("posterUrl", url);
          }}
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field>
          <FieldLabel>Seating mode</FieldLabel>
          <Select
            value={form.watch("seatingMode")}
            onValueChange={(v) =>
              form.setValue("seatingMode", v as "ga" | "reserved")
            }
            disabled={seatingModeLocked}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ga">General admission</SelectItem>
              <SelectItem value="reserved">Reserved seating</SelectItem>
            </SelectContent>
          </Select>
          {seatingModeLocked && (
            <p className="text-muted-foreground text-xs">
              Locked — orders already exist.
            </p>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="maxPerOrder">Max per order</FieldLabel>
          <Input
            id="maxPerOrder"
            type="number"
            min={1}
            {...form.register("maxPerOrder", { valueAsNumber: true })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="refundCutoffDays">
            Refund cutoff (days)
          </FieldLabel>
          <Input
            id="refundCutoffDays"
            type="number"
            min={0}
            {...form.register("refundCutoffDays", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
