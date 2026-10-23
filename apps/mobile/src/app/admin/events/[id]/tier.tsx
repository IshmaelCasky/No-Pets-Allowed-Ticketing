import { useState } from "react";
import { Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTicketTierSchema,
  updateTicketTierSchema,
} from "@npa/validators";

import type { FieldErrors } from "~/components/events-admin/form-utils";
import type { Tier } from "~/components/events-admin/use-inventory";
import { RequirePerm } from "~/components/admin";
import {
  DateTimeField,
  FormScroll,
  ImageUploadField,
} from "~/components/events-admin/form-parts";
import {
  centavosToPesos,
  issuesToErrors,
  parseIntField,
  parseManilaInput,
  pesosToCentavos,
  toManilaInput,
} from "~/components/events-admin/form-utils";
import { Button, Card, Empty, Field, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { showError } from "~/utils/feedback";
import { formatCentavos } from "~/utils/format";

type Key =
  | "name"
  | "price"
  | "capacity"
  | "salesStartAt"
  | "salesEndAt"
  | "sortOrder"
  | "imageUrl";

function TierForm({
  eventId,
  tier,
  nextSortOrder,
}: {
  eventId: string;
  tier?: Tier;
  nextSortOrder: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(tier?.name ?? "");
  const [price, setPrice] = useState(tier ? centavosToPesos(tier.price) : "");
  const [capacity, setCapacity] = useState(String(tier?.capacity ?? 100));
  const [salesStartAt, setSalesStartAt] = useState(
    toManilaInput(tier?.salesStartAt),
  );
  const [salesEndAt, setSalesEndAt] = useState(toManilaInput(tier?.salesEndAt));
  const [sortOrder, setSortOrder] = useState(
    String(tier?.sortOrder ?? nextSortOrder),
  );
  const [imageUrl, setImageUrl] = useState(tier?.imageUrl ?? "");
  const [errors, setErrors] = useState<FieldErrors<Key>>({});

  const done = () => {
    void queryClient.invalidateQueries(
      trpc.event.tiersByEvent.queryFilter({ eventId }),
    );
    router.back();
  };
  const create = useMutation(
    trpc.event.createTier.mutationOptions({
      onSuccess: done,
      onError: (e) => showError(e, "Couldn't add tier"),
    }),
  );
  const update = useMutation(
    trpc.event.updateTier.mutationOptions({
      onSuccess: done,
      onError: (e) => showError(e, "Couldn't save tier"),
    }),
  );

  const committed = tier ? tier.reserved + tier.sold : 0;
  const centavos = pesosToCentavos(price);

  const submit = () => {
    const next: FieldErrors<Key> = {};
    const start = parseManilaInput(salesStartAt);
    const end = parseManilaInput(salesEndAt);
    if (!start.ok) next.salesStartAt = start.message;
    else if (!start.value && tier?.salesStartAt) {
      next.salesStartAt =
        "A saved sales start can't be cleared — change it instead";
    }
    if (!end.ok) next.salesEndAt = end.message;
    else if (!end.value && tier?.salesEndAt) {
      next.salesEndAt =
        "A saved sales end can't be cleared — change it instead";
    }
    if (Number.isNaN(centavos))
      next.price = "Enter an amount like 1500 or 1500.50";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    const base = {
      name,
      price: centavos,
      capacity: parseIntField(capacity),
      salesStartAt: start.ok ? start.value : undefined,
      salesEndAt: end.ok ? end.value : undefined,
      sortOrder: parseIntField(sortOrder),
      imageUrl: imageUrl.trim() || undefined,
    };

    if (tier) {
      const parsed = updateTicketTierSchema.safeParse({ id: tier.id, ...base });
      // The update schema has no start ≤ end check; mirror the create rule.
      const s = parsed.success ? parsed.data.salesStartAt : undefined;
      const e = parsed.success ? parsed.data.salesEndAt : undefined;
      if (!parsed.success) {
        setErrors(issuesToErrors<Key>(parsed.error.issues));
      } else if (s && e && s > e) {
        setErrors({ salesEndAt: "Sales start must be before sales end" });
      } else if (
        parsed.data.capacity !== undefined &&
        parsed.data.capacity < committed
      ) {
        setErrors({
          capacity: `Can't go below ${committed} (reserved + sold)`,
        });
      } else {
        setErrors({});
        update.mutate(parsed.data);
      }
      return;
    }

    const parsed = createTicketTierSchema.safeParse({ eventId, ...base });
    if (!parsed.success) {
      setErrors(issuesToErrors<Key>(parsed.error.issues));
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  };

  return (
    <FormScroll>
      <Stack.Screen options={{ title: tier ? "Edit tier" : "Add tier" }} />
      {tier ? (
        <Card>
          <Text className="text-muted-foreground text-sm">
            {tier.sold} sold · {tier.reserved} reserved ·{" "}
            {tier.capacity - tier.sold - tier.reserved} left
          </Text>
        </Card>
      ) : null}
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="General Admission"
        error={errors.name}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field
            label="Price (₱)"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="1500"
            error={errors.price}
          />
        </View>
        <View className="flex-1">
          <Field
            label="Capacity"
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
            error={errors.capacity}
          />
        </View>
      </View>
      {!Number.isNaN(centavos) && price.trim() !== "" ? (
        <Text className="text-muted-foreground -mt-2 text-xs">
          Customers pay {formatCentavos(centavos)} per ticket
        </Text>
      ) : null}
      <DateTimeField
        label="Sales start"
        value={salesStartAt}
        onChangeText={setSalesStartAt}
        error={errors.salesStartAt}
        optional
      />
      <DateTimeField
        label="Sales end"
        value={salesEndAt}
        onChangeText={setSalesEndAt}
        error={errors.salesEndAt}
        optional
      />
      <Field
        label="Sort order"
        value={sortOrder}
        onChangeText={setSortOrder}
        keyboardType="number-pad"
        error={errors.sortOrder}
      />
      <ImageUploadField
        label="Artwork · optional"
        value={imageUrl}
        onChange={setImageUrl}
        // A saved image can be replaced but not cleared (API contract).
        onRemove={tier?.imageUrl ? undefined : () => setImageUrl("")}
        hint="Shown on checkout and the ticket. JPG, PNG or WEBP · max 4 MB"
      />
      {errors.imageUrl ? (
        <Text className="text-destructive text-xs">{errors.imageUrl}</Text>
      ) : null}
      <Button
        label={tier ? "Save tier" : "Add tier"}
        onPress={submit}
        loading={create.isPending || update.isPending}
      />
    </FormScroll>
  );
}

function TierScreenBody({ id, tierId }: { id: string; tierId?: string }) {
  const tiersQ = useQuery(
    trpc.event.tiersByEvent.queryOptions({ eventId: id }),
  );
  if (tiersQ.isLoading) return <Loading />;
  const tiers = tiersQ.data ?? [];
  const tier = tierId ? tiers.find((t) => t.id === tierId) : undefined;
  if (tierId && !tier) return <Empty title="Tier not found" />;
  const nextSortOrder = tiers.reduce((m, t) => Math.max(m, t.sortOrder + 1), 0);
  return (
    <TierForm
      key={tier?.id ?? "new"}
      eventId={id}
      tier={tier}
      nextSortOrder={nextSortOrder}
    />
  );
}

export default function TierScreen() {
  const { id, tierId } = useLocalSearchParams<{
    id: string;
    tierId?: string;
  }>();
  return (
    <RequirePerm anyOf={["events:write"]}>
      <TierScreenBody id={id} tierId={tierId} />
    </RequirePerm>
  );
}
