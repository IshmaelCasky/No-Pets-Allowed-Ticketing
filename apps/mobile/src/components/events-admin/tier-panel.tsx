import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Tier } from "./use-inventory";
import { SectionHeader, Stat } from "~/components/admin";
import { Card } from "~/components/ui";
import { trpc } from "~/utils/api";
import { confirm, showError } from "~/utils/feedback";
import { formatCentavos, formatManila } from "~/utils/format";

function salesWindow(t: Tier): string | null {
  if (!t.salesStartAt && !t.salesEndAt) return null;
  return `Sales ${t.salesStartAt ? formatManila(t.salesStartAt) : "now"} → ${
    t.salesEndAt ? formatManila(t.salesEndAt) : "show"
  }`;
}

/** Stacked bar: sold (rose) + reserved (amber) over capacity. */
function UsageBar({ tier }: { tier: Tier }) {
  const cap = Math.max(tier.capacity, 1);
  return (
    <View className="bg-muted h-2 flex-row overflow-hidden rounded-full">
      <View
        style={{ width: `${(tier.sold / cap) * 100}%` }}
        className="bg-rose-500"
      />
      <View
        style={{ width: `${(tier.reserved / cap) * 100}%` }}
        className="bg-amber-500"
      />
    </View>
  );
}

export function SmallButton({
  label,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`border-border flex-1 items-center rounded-lg border py-2.5 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <Text
        className={`text-sm font-semibold ${
          destructive ? "text-destructive" : "text-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** GA ticket tiers with live sold / reserved / remaining. */
export function TierPanel({
  eventId,
  tiers,
  canWrite,
}: {
  eventId: string;
  tiers: readonly Tier[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const remove = useMutation(
    trpc.event.deleteTier.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.event.tiersByEvent.queryFilter({ eventId }),
        ),
      onError: (e) => showError(e),
    }),
  );

  const totals = tiers.reduce(
    (acc, t) => ({
      capacity: acc.capacity + t.capacity,
      sold: acc.sold + t.sold,
      reserved: acc.reserved + t.reserved,
    }),
    { capacity: 0, sold: 0, reserved: 0 },
  );

  const openTier = (tierId?: string) =>
    router.push({
      pathname: "/admin/events/[id]/tier",
      params: tierId ? { id: eventId, tierId } : { id: eventId },
    });

  return (
    <View className="gap-3">
      <SectionHeader
        title="Ticket tiers"
        action={
          canWrite ? (
            <Pressable onPress={() => openTier()} hitSlop={8}>
              <Text className="text-primary text-sm font-semibold">
                + Add tier
              </Text>
            </Pressable>
          ) : null
        }
      />
      {tiers.length > 0 ? (
        <View className="flex-row gap-2">
          <Stat className="flex-1" label="Sold" value={totals.sold} />
          <Stat className="flex-1" label="Reserved" value={totals.reserved} />
          <Stat
            className="flex-1"
            label="Left"
            value={totals.capacity - totals.sold - totals.reserved}
          />
        </View>
      ) : (
        <Card>
          <Text className="text-muted-foreground text-center text-sm">
            No tiers yet.{canWrite ? " Add one to start selling." : ""}
          </Text>
        </Card>
      )}

      {tiers.map((t) => {
        const remaining = t.capacity - t.reserved - t.sold;
        const committed = t.reserved + t.sold > 0;
        const window = salesWindow(t);
        return (
          <Card key={t.id} className="gap-3">
            <View className="flex-row items-center gap-3">
              {t.imageUrl ? (
                <Image
                  source={{ uri: t.imageUrl }}
                  className="bg-muted h-12 w-12 rounded-lg"
                />
              ) : (
                <View className="bg-muted h-12 w-12 rounded-lg" />
              )}
              <View className="flex-1">
                <Text
                  className="text-foreground text-base font-semibold"
                  numberOfLines={1}
                >
                  {t.name}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {formatCentavos(t.price)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-foreground text-lg font-bold">
                  {remaining}
                </Text>
                <Text className="text-muted-foreground text-xs">left</Text>
              </View>
            </View>
            <UsageBar tier={t} />
            <Text className="text-muted-foreground text-xs">
              {t.sold} sold · {t.reserved} reserved · {t.capacity} capacity
            </Text>
            {window ? (
              <Text className="text-muted-foreground text-xs">{window}</Text>
            ) : null}
            {canWrite ? (
              <View className="flex-row gap-2">
                <SmallButton label="Edit" onPress={() => openTier(t.id)} />
                <SmallButton
                  label="Delete"
                  destructive
                  disabled={committed || remove.isPending}
                  onPress={() =>
                    confirm({
                      title: `Delete “${t.name}”?`,
                      message:
                        "Only tiers with no reserved or sold tickets can be deleted.",
                      confirmLabel: "Delete",
                      destructive: true,
                      onConfirm: () => remove.mutate({ id: t.id }),
                    })
                  }
                />
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
