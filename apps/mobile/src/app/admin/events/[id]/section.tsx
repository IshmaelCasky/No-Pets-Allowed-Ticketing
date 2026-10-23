import { useState } from "react";
import { Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RowLabelStyle } from "@npa/validators";
import {
  createSeatSectionSchema,
  updateSeatSectionSchema,
} from "@npa/validators";

import type { FieldErrors } from "~/components/events-admin/form-utils";
import type { Section } from "~/components/events-admin/use-inventory";
import { RequirePerm } from "~/components/admin";
import {
  ChoiceRow,
  ColorField,
  FieldShell,
  FormScroll,
} from "~/components/events-admin/form-parts";
import {
  centavosToPesos,
  issuesToErrors,
  parseIntField,
  pesosToCentavos,
} from "~/components/events-admin/form-utils";
import {
  DEFAULT_SECTION_COLOR,
  rowLabelFor,
} from "~/components/events-admin/status";
import { seatCounts } from "~/components/events-admin/use-inventory";
import { Button, Card, Empty, Field, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { showError } from "~/utils/feedback";
import { formatCentavos } from "~/utils/format";

type Key =
  | "name"
  | "price"
  | "rows"
  | "seatsPerRow"
  | "rowLabelStyle"
  | "color"
  | "sortOrder";

const LABEL_STYLES: readonly { value: RowLabelStyle; label: string }[] = [
  { value: "alpha", label: "A, B, C…" },
  { value: "numeric", label: "1, 2, 3…" },
];

function SectionForm({
  eventId,
  section,
  committedSeats,
  nextSortOrder,
}: {
  eventId: string;
  section?: Section;
  /** Held + sold seats in this section (relabelling is blocked if > 0). */
  committedSeats: number;
  nextSortOrder: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(section?.name ?? "");
  const [price, setPrice] = useState(
    section ? centavosToPesos(section.price) : "",
  );
  const [rows, setRows] = useState(String(section?.rows ?? 5));
  const [seatsPerRow, setSeatsPerRow] = useState(
    String(section?.seatsPerRow ?? 10),
  );
  const [rowLabelStyle, setRowLabelStyle] = useState<RowLabelStyle>(
    section?.rowLabelStyle ?? "alpha",
  );
  const [color, setColor] = useState(section?.color ?? DEFAULT_SECTION_COLOR);
  const [errors, setErrors] = useState<FieldErrors<Key>>({});

  const done = () => {
    void queryClient.invalidateQueries(
      trpc.seatMap.forEvent.queryFilter({ eventId }),
    );
    router.back();
  };
  const create = useMutation(
    trpc.seatMap.createSection.mutationOptions({
      onSuccess: done,
      onError: (e) => showError(e, "Couldn't add section"),
    }),
  );
  const update = useMutation(
    trpc.seatMap.updateSection.mutationOptions({
      onSuccess: done,
      onError: (e) => showError(e, "Couldn't save section"),
    }),
  );

  const centavos = pesosToCentavos(price);
  const nRows = parseIntField(rows);
  const nSeats = parseIntField(seatsPerRow);
  const preview =
    nRows > 0 && nSeats > 0 && nRows <= 100 && nSeats <= 100
      ? `Rows ${rowLabelFor(0, rowLabelStyle)}–${rowLabelFor(
          nRows - 1,
          rowLabelStyle,
        )} × ${nSeats} seats = ${nRows * nSeats} seats · e.g. ${
          name.trim() || "VIP"
        }-${rowLabelFor(0, rowLabelStyle)}1`
      : null;

  const submit = () => {
    if (Number.isNaN(centavos)) {
      setErrors({ price: "Enter an amount like 1500 or 1500.50" });
      return;
    }
    if (section) {
      const relabel =
        name.trim() !== section.name || rowLabelStyle !== section.rowLabelStyle;
      if (relabel && committedSeats > 0) {
        setErrors({
          name: "Name and row labels can't change while seats are held or sold",
        });
        return;
      }
      const parsed = updateSeatSectionSchema.safeParse({
        id: section.id,
        name,
        price: centavos,
        rowLabelStyle,
        color,
      });
      if (!parsed.success) {
        setErrors(issuesToErrors<Key>(parsed.error.issues));
        return;
      }
      setErrors({});
      update.mutate(parsed.data);
      return;
    }
    const parsed = createSeatSectionSchema.safeParse({
      eventId,
      name,
      price: centavos,
      rows: nRows,
      seatsPerRow: nSeats,
      rowLabelStyle,
      color,
      sortOrder: nextSortOrder,
    });
    if (!parsed.success) {
      setErrors(issuesToErrors<Key>(parsed.error.issues));
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  };

  return (
    <FormScroll>
      <Stack.Screen
        options={{ title: section ? "Edit section" : "Add section" }}
      />
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="VIP"
        error={errors.name}
      />
      <Field
        label="Price per seat (₱)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="2500"
        error={errors.price}
      />
      {!Number.isNaN(centavos) && price.trim() !== "" ? (
        <Text className="text-muted-foreground -mt-2 text-xs">
          {formatCentavos(centavos)} per seat
        </Text>
      ) : null}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field
            label="Rows"
            value={rows}
            onChangeText={setRows}
            keyboardType="number-pad"
            editable={!section}
            error={errors.rows}
          />
        </View>
        <View className="flex-1">
          <Field
            label="Seats per row"
            value={seatsPerRow}
            onChangeText={setSeatsPerRow}
            keyboardType="number-pad"
            editable={!section}
            error={errors.seatsPerRow}
          />
        </View>
      </View>
      <Text className="text-muted-foreground -mt-2 text-xs">
        {section
          ? "Rows and seats per row are fixed once a section is created."
          : "Up to 100 × 100. Block individual seats afterwards."}
      </Text>
      <FieldShell label="Row labels" error={errors.rowLabelStyle}>
        <ChoiceRow
          options={LABEL_STYLES}
          value={rowLabelStyle}
          onChange={setRowLabelStyle}
        />
      </FieldShell>
      <ColorField value={color} onChange={setColor} error={errors.color} />
      {preview ? (
        <Card>
          <Text className="text-muted-foreground text-sm">{preview}</Text>
        </Card>
      ) : null}
      <Button
        label={section ? "Save section" : "Add section"}
        onPress={submit}
        loading={create.isPending || update.isPending}
      />
    </FormScroll>
  );
}

function SectionScreenBody({
  id,
  sectionId,
}: {
  id: string;
  sectionId?: string;
}) {
  const mapQ = useQuery(trpc.seatMap.forEvent.queryOptions({ eventId: id }));
  if (mapQ.isLoading) return <Loading />;
  const sections = mapQ.data?.sections ?? [];
  const section = sectionId
    ? sections.find((s) => s.id === sectionId)
    : undefined;
  if (sectionId && !section) return <Empty title="Section not found" />;
  const c = seatCounts(
    (mapQ.data?.seats ?? []).filter((s) => s.sectionId === sectionId),
  );
  const nextSortOrder = sections.reduce(
    (m, s) => Math.max(m, s.sortOrder + 1),
    0,
  );
  return (
    <SectionForm
      key={section?.id ?? "new"}
      eventId={id}
      section={section}
      committedSeats={c.held + c.sold}
      nextSortOrder={nextSortOrder}
    />
  );
}

export default function SectionScreen() {
  const { id, sectionId } = useLocalSearchParams<{
    id: string;
    sectionId?: string;
  }>();
  return (
    <RequirePerm anyOf={["events:write"]}>
      <SectionScreenBody id={id} sectionId={sectionId} />
    </RequirePerm>
  );
}
