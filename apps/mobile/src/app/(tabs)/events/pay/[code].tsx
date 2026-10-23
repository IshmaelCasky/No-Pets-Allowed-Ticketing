import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text } from "react-native";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Card, Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { formatCentavos } from "~/utils/format";

const POLL_MS = 3000;
const MAX_POLLS = 10;

export default function PayScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const pollCount = useRef(0);
  const syncedRef = useRef(false);

  const orderOptions = trpc.order.byCode.queryOptions({ code });
  const orderQ = useQuery({
    ...orderOptions,
    refetchInterval: (query) =>
      query.state.data?.status === "pending_payment" &&
      pollCount.current < MAX_POLLS
        ? POLL_MS
        : false,
  });
  const order = orderQ.data;

  // Count poll fetches while still pending so we stop after a handful.
  useEffect(() => {
    if (order?.status === "pending_payment") pollCount.current += 1;
  }, [orderQ.dataUpdatedAt, order?.status]);

  const syncPayment = useMutation(
    trpc.order.syncPayment.mutationOptions({
      onSuccess: (updated) => {
        queryClient.setQueryData(orderOptions.queryKey, updated);
        void queryClient.invalidateQueries(trpc.order.myOrders.queryFilter());
      },
      onError: (e) => setError(e.message),
    }),
  );

  // On focus, reconcile against HitPay once, then let polling take over.
  useFocusEffect(
    useCallback(() => {
      if (syncedRef.current) return;
      syncedRef.current = true;
      pollCount.current = 0;
      setError(null);
      syncPayment.mutate({ code });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]),
  );

  const refresh = () => {
    setError(null);
    pollCount.current = 0;
    syncPayment.mutate({ code });
  };

  if (orderQ.isLoading) return <Loading />;
  if (!order) return <Empty title="Order not found" />;

  return (
    <ScrollView contentContainerClassName="p-4 gap-4 pb-28">
      <Stack.Screen options={{ title: `Order · ${order.code}` }} />

      <Card className="gap-1">
        <Text className="text-muted-foreground text-xs">Total</Text>
        <Text className="text-primary text-2xl font-bold">
          {formatCentavos(order.totalAmount)}
        </Text>
      </Card>

      {order.status === "pending_payment" ? (
        <Card className="border-primary gap-3">
          <Loading label="Waiting for payment confirmation…" />
          <Text className="text-muted-foreground text-sm">
            Finish paying in the checkout window that opened. This screen
            updates automatically once your payment clears. If it stays here,
            tap below to re-check.
          </Text>
          <Button
            label="Check again"
            variant="outline"
            loading={syncPayment.isPending}
            onPress={refresh}
          />
        </Card>
      ) : order.status === "approved" ? (
        <Card className="gap-3 border-green-600">
          <Text className="text-xl font-bold text-green-600">
            Payment confirmed
          </Text>
          <Text className="text-muted-foreground text-sm">
            Your tickets are ready. View them under My Tickets.
          </Text>
          <Button
            label="View my tickets"
            onPress={() => router.replace("/(tabs)/tickets")}
          />
        </Card>
      ) : order.status === "refunded" ? (
        <Card className="border-border gap-1">
          <Text className="text-foreground font-semibold">Order refunded</Text>
          <Text className="text-muted-foreground text-sm">
            This order has been refunded.
          </Text>
        </Card>
      ) : (
        <Card className="border-destructive gap-1">
          <Text className="text-destructive font-semibold">
            {order.status === "expired" ? "Order expired" : "Order closed"}
          </Text>
          <Text className="text-muted-foreground text-sm">
            {order.status === "expired"
              ? "This order expired before payment was confirmed. Your tickets have been released."
              : order.status === "cancelled"
                ? "This order was cancelled."
                : "This order is no longer awaiting payment."}
          </Text>
        </Card>
      )}

      {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
    </ScrollView>
  );
}
