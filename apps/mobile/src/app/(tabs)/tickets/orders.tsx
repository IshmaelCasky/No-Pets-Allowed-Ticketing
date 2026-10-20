import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { Button, Card, Empty, Loading, StatusBadge } from "~/components/ui";
import { trpc } from "~/utils/api";
import { formatCentavos, formatManila } from "~/utils/format";

type Order = RouterOutputs["order"]["myOrders"][number];

function OrderCard({
  order,
  eventTitle,
}: {
  order: Order;
  eventTitle: string;
}) {
  const router = useRouter();
  const payable =
    order.status === "pending_payment" || order.status === "rejected";
  return (
    <Card className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground font-semibold">{order.code}</Text>
        <StatusBadge status={order.status} />
      </View>
      <Text className="text-muted-foreground text-sm">{eventTitle}</Text>
      <View className="flex-row justify-between">
        <Text className="text-muted-foreground text-xs">
          {formatManila(order.createdAt)}
        </Text>
        <Text className="text-primary font-bold">
          {formatCentavos(order.totalAmount)}
        </Text>
      </View>
      {payable ? (
        <Button
          label="Pay now"
          onPress={() => router.push(`/(tabs)/events/pay/${order.code}`)}
        />
      ) : null}
      {order.status === "approved" ? (
        <Pressable
          onPress={() => router.push(`/(tabs)/account/refund/${order.code}`)}
        >
          <Text className="text-primary text-center font-semibold">
            Request refund
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export default function OrdersScreen() {
  const ordersQ = useQuery(trpc.order.myOrders.queryOptions());
  const eventsQ = useQuery(trpc.event.publicList.queryOptions());

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of eventsQ.data ?? []) m.set(e.id, e.title);
    return m;
  }, [eventsQ.data]);

  if (ordersQ.isLoading) return <Loading />;
  if (!ordersQ.data || ordersQ.data.length === 0) {
    return <Empty title="No orders yet" />;
  }

  return (
    <FlatList
      data={ordersQ.data}
      keyExtractor={(o) => o.id}
      contentContainerClassName="p-4 gap-3"
      renderItem={({ item }) => (
        <OrderCard
          order={item}
          eventTitle={titleById.get(item.eventId) ?? "Event"}
        />
      )}
    />
  );
}
