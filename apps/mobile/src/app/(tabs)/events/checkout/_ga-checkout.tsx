import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { Button, Card, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { formatCentavos } from "~/utils/format";

type Event = RouterOutputs["event"]["bySlug"];

function QtyStepper({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={() => onChange(Math.max(0, value - 1))}
        className="bg-secondary h-9 w-9 items-center justify-center rounded-full"
      >
        <Text className="text-foreground text-xl">−</Text>
      </Pressable>
      <Text className="text-foreground w-6 text-center text-base font-semibold">
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        className="bg-secondary h-9 w-9 items-center justify-center rounded-full"
      >
        <Text className="text-foreground text-xl">+</Text>
      </Pressable>
    </View>
  );
}

export function GaCheckout({ event }: { event: NonNullable<Event> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});

  const tiersQ = useQuery(
    trpc.event.tiersByEvent.queryOptions({ eventId: event.id }),
  );

  const createOrder = useMutation(
    trpc.order.create.mutationOptions({
      onSuccess: async ({ order, paymentUrl }) => {
        await WebBrowser.openBrowserAsync(paymentUrl);
        router.replace(`/(tabs)/events/pay/${order.code}`);
      },
      onError: (e) => setError(e.message),
    }),
  );

  const totalQty = useMemo(
    () => Object.values(qty).reduce((s, n) => s + n, 0),
    [qty],
  );
  const total = useMemo(() => {
    if (!tiersQ.data) return 0;
    return tiersQ.data.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.price, 0);
  }, [qty, tiersQ.data]);

  if (tiersQ.isLoading) return <Loading label="Loading tiers…" />;

  const submit = () => {
    setError(null);
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([tierId, quantity]) => ({ tierId, quantity }));
    if (items.length === 0) {
      setError("Select at least one ticket");
      return;
    }
    createOrder.mutate({ mode: "ga", eventId: event.id, items });
  };

  return (
    <ScrollView contentContainerClassName="p-4 gap-4 pb-28">
      <Text className="text-muted-foreground text-sm">
        Up to {event.maxPerOrder} tickets per order.
      </Text>

      {tiersQ.data?.map((t) => {
        const remaining = t.capacity - t.reserved - t.sold;
        const current = qty[t.id] ?? 0;
        // Cap at remaining stock and at the per-order max (minus other lines).
        const maxForTier = Math.max(
          current,
          Math.min(remaining, event.maxPerOrder - (totalQty - current)),
        );
        return (
          <Card key={t.id} className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-foreground font-semibold">{t.name}</Text>
              <Text className="text-primary font-bold">
                {formatCentavos(t.price)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-muted-foreground text-sm">
                {remaining > 0 ? `${remaining} left` : "Sold out"}
              </Text>
              {remaining > 0 ? (
                <QtyStepper
                  value={current}
                  max={maxForTier}
                  onChange={(n) => setQty((p) => ({ ...p, [t.id]: n }))}
                />
              ) : null}
            </View>
          </Card>
        );
      })}

      {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

      <Card className="flex-row justify-between">
        <Text className="text-foreground font-semibold">Total</Text>
        <Text className="text-primary text-lg font-bold">
          {formatCentavos(total)}
        </Text>
      </Card>

      <Button
        label={totalQty > 0 ? `Reserve ${totalQty} ticket(s)` : "Reserve"}
        onPress={submit}
        loading={createOrder.isPending}
        disabled={totalQty === 0}
      />
    </ScrollView>
  );
}
