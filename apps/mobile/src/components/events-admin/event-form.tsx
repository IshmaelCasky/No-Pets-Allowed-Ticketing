import { useState } from "react";
import { Text, View } from "react-native";

import type { CreateEventInput, SeatingMode } from "@npa/validators";
import { createEventSchema } from "@npa/validators";

import type { FieldErrors } from "./form-utils";
import type { RouterOutputs } from "~/utils/api";
import { Button, Field } from "~/components/ui";
import {
  ChoiceRow,
  DateTimeField,
  FieldShell,
  FormScroll,
  ImageUploadField,
  TextAreaField,
} from "./form-parts";
import {
  blankToUndefined,
  issuesToErrors,
  parseIntField,
  parseManilaInput,
  slugify,
  toManilaInput,
} from "./form-utils";

type Concert = NonNullable<RouterOutputs["event"]["byId"]>;

/** Validated values, ready for `event.create` / `event.update` (no status). */
export type EventFormValues = Omit<CreateEventInput, "status">;

type Key =
  | "title"
  | "slug"
  | "venue"
  | "startsAt"
  | "doorsOpenAt"
  | "lineup"
  | "description"
  | "posterUrl"
  | "seatingMode"
  | "maxPerOrder"
  | "refundCutoffDays";

const SEATING_OPTIONS: readonly { value: SeatingMode; label: string }[] = [
  { value: "ga", label: "General admission" },
  { value: "reserved", label: "Reserved seats" },
];

/**
 * Create / edit a concert. Mirrors the web form; validates with the shared
 * `createEventSchema`. Dates are typed as Manila time.
 */
export function EventForm({
  initial,
  seatingModeLocked,
  submitting,
  submitLabel,
  onSubmit,
}: {
  initial?: Concert;
  /** Seating mode can't change once orders exist (enforced by the API). */
  seatingModeLocked?: boolean;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => void;
}) {
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(editing);
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [startsAt, setStartsAt] = useState(toManilaInput(initial?.startsAt));
  const [doorsOpenAt, setDoorsOpenAt] = useState(
    toManilaInput(initial?.doorsOpenAt),
  );
  const [lineup, setLineup] = useState(initial?.lineup ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [posterUrl, setPosterUrl] = useState(initial?.posterUrl ?? "");
  const [seatingMode, setSeatingMode] = useState<SeatingMode>(
    initial?.seatingMode ?? "ga",
  );
  const [maxPerOrder, setMaxPerOrder] = useState(
    String(initial?.maxPerOrder ?? 4),
  );
  const [refundCutoffDays, setRefundCutoffDays] = useState(
    String(initial?.refundCutoffDays ?? 7),
  );
  const [errors, setErrors] = useState<FieldErrors<Key>>({});

  const submit = () => {
    const next: FieldErrors<Key> = {};
    const starts = parseManilaInput(startsAt);
    const doors = parseManilaInput(doorsOpenAt);
    if (!starts.ok) next.startsAt = starts.message;
    else if (!starts.value) next.startsAt = "Start time is required";
    if (!doors.ok) next.doorsOpenAt = doors.message;
    else if (!doors.value && initial?.doorsOpenAt) {
      // The update contract can't clear a saved time (undefined = unchanged).
      next.doorsOpenAt =
        "A saved doors time can't be cleared — change it instead";
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    const parsed = createEventSchema.safeParse({
      title,
      slug,
      venue,
      startsAt: starts.ok ? starts.value : undefined,
      doorsOpenAt: doors.ok ? doors.value : undefined,
      // On edit, a blank string clears the saved text; on create, omit it.
      lineup: editing ? lineup.trim() : blankToUndefined(lineup),
      description: editing ? description.trim() : blankToUndefined(description),
      posterUrl: blankToUndefined(posterUrl),
      seatingMode,
      maxPerOrder: parseIntField(maxPerOrder),
      refundCutoffDays: parseIntField(refundCutoffDays),
    });
    if (!parsed.success) {
      setErrors(issuesToErrors<Key>(parsed.error.issues));
      return;
    }
    setErrors({});
    const { status: _status, ...values } = parsed.data;
    onSubmit(values);
  };

  return (
    <FormScroll>
      <Field
        label="Title"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (!slugTouched) setSlug(slugify(v));
        }}
        placeholder="No Pets Allowed: Live in Manila"
        error={errors.title}
      />
      <Field
        label="Slug"
        value={slug}
        onChangeText={(v) => {
          setSlugTouched(true);
          setSlug(v);
        }}
        placeholder="npa-live-2026"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.slug}
      />
      <Field
        label="Venue"
        value={venue}
        onChangeText={setVenue}
        placeholder="New Frontier Theater"
        error={errors.venue}
      />
      <DateTimeField
        label="Starts"
        value={startsAt}
        onChangeText={setStartsAt}
        error={errors.startsAt}
      />
      <DateTimeField
        label="Doors open"
        value={doorsOpenAt}
        onChangeText={setDoorsOpenAt}
        error={errors.doorsOpenAt}
        optional
      />
      <Field
        label="Lineup · optional"
        value={lineup}
        onChangeText={setLineup}
        placeholder="No Pets Allowed, special guests"
        error={errors.lineup}
      />
      <TextAreaField
        label="Description · optional"
        value={description}
        onChangeText={setDescription}
        error={errors.description}
      />
      <ImageUploadField
        label="Poster"
        value={posterUrl}
        onChange={setPosterUrl}
        // A saved poster can be replaced but not cleared (API contract).
        onRemove={initial?.posterUrl ? undefined : () => setPosterUrl("")}
      />
      {errors.posterUrl ? (
        <Text className="text-destructive text-xs">{errors.posterUrl}</Text>
      ) : null}

      <FieldShell
        label="Seating mode"
        hint={
          seatingModeLocked
            ? "Locked — this concert already has orders."
            : "GA sells ticket tiers; reserved sells exact seats from a seat map."
        }
        error={errors.seatingMode}
      >
        <ChoiceRow
          options={SEATING_OPTIONS}
          value={seatingMode}
          onChange={setSeatingMode}
          disabled={seatingModeLocked}
        />
      </FieldShell>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field
            label="Max per order"
            value={maxPerOrder}
            onChangeText={setMaxPerOrder}
            keyboardType="number-pad"
            error={errors.maxPerOrder}
          />
        </View>
        <View className="flex-1">
          <Field
            label="Refund cutoff (days)"
            value={refundCutoffDays}
            onChangeText={setRefundCutoffDays}
            keyboardType="number-pad"
            error={errors.refundCutoffDays}
          />
        </View>
      </View>
      <Text className="text-muted-foreground text-xs">
        Refund requests close this many days before the show starts.
      </Text>

      <Button label={submitLabel} onPress={submit} loading={submitting} />
    </FormScroll>
  );
}
