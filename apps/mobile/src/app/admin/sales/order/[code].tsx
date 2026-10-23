import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Tone } from "~/components/admin";
import type { RouterOutputs } from "~/utils/api";
import { KeyValue, Pill, RequirePerm, SectionHeader } from "~/components/admin";
import { hitpayLabel } from "~/components/ops/status";
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  StatusBadge,
} from "~/components/ui";
import { trpc } from "~/utils/api";
import { confirm, errorMessage, showError } from "~/utils/feedback";
import { formatCentavos, formatManila } from "~/utils/format";
import { usePermissions } from "~/utils/use-permissions";

type Order = RouterOutputs["order"]["adminDetail"];
type Ticket = Order["tickets"][number];

const TICKET_UI: Record<Ticket["status"], { label: string; tone: Tone }> = {
  active: { label: "Not checked in", tone: "blue" },
  used: { label: "Checked in", tone: "green" },
  void: { label: "Void", tone: "gray" },
};

function Timeline({ order }: { order: Order }) {
  const steps: { label: string; at: Date | null; tone: Tone }[] = [
    {
      label: "Order created — inventory held",
      at: order.createdAt,
      tone: "gray",
    },
  ];
  if (order.paidAt) {
    steps.push({ label: "Paid via HitPay", at: order.paidAt, tone: "green" });
  }
  if (order.status === "pending_payment") {
    steps.push({
      label: "Payment window ends",
      at: order.expiresAt,
      tone: "amber",
    });
  }
  if (order.status === "expired") {
    steps.push({
      label: "Expired — inventory released",
      at: order.expiresAt,
      tone: "gray",
    });
  }
  if (order.status === "cancelled") {
    steps.push({
      label: "Cancelled — inventory released",
      at: null,
      tone: "gray",
    });
  }
  if (order.status === "refunded") {
    steps.push({ label: "Refunded", at: null, tone: "purple" });
  }
  return (
    <Card className="gap-3">
      {steps.map((s) => (
        <View key={s.label} className="flex-row items-start gap-3">
          <View className="pt-1">
            <Pill label="●" tone={s.tone} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-sm font-medium">
              {s.label}
            </Text>
            {s.at ? (
              <Text className="text-muted-foreground text-xs">
                {formatManila(s.at)}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

/** Line items (unit price at purchase), buyer and issued tickets. */
function ItemsBuyerTickets({ order }: { order: Order }) {
  return (
    <>
      <SectionHeader title="Items" />
      <Card className="gap-2">
        {order.items.length === 0 ? (
          <Text className="text-muted-foreground text-sm">No items.</Text>
        ) : (
          order.items.map((it) => (
            <View key={it.id} className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text className="text-foreground text-sm font-semibold">
                  {it.seatLabel ?? it.tierName ?? "Ticket"}
                </Text>
                <Text className="text-muted-foreground text-xs">
                  {it.quantity} × {formatCentavos(it.unitPrice)}
                </Text>
              </View>
              <Text className="text-foreground text-sm font-semibold">
                {formatCentavos(it.quantity * it.unitPrice)}
              </Text>
            </View>
          ))
        )}
        <View className="border-border mt-1 flex-row justify-between border-t pt-2">
          <Text className="text-foreground text-sm font-bold">Total</Text>
          <Text className="text-foreground text-sm font-bold">
            {formatCentavos(order.totalAmount)}
          </Text>
        </View>
      </Card>

      <SectionHeader title="Buyer" />
      <Card>
        <KeyValue label="Name" value={order.buyerName ?? "—"} />
        <KeyValue label="Email" value={order.buyerEmail ?? "—"} />
      </Card>

      <SectionHeader title={`Tickets (${order.tickets.length})`} />
      <Card className="gap-3">
        {order.tickets.length === 0 ? (
          <Text className="text-muted-foreground text-sm">
            {order.status === "pending_payment"
              ? "Tickets are issued once HitPay confirms the payment."
              : "No tickets for this order."}
          </Text>
        ) : (
          order.tickets.map((t) => {
            const ui = TICKET_UI[t.status];
            return (
              <View key={t.id} className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-semibold">
                    {t.seatLabel ?? t.tierName ?? "Ticket"}
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    {t.holderName ?? order.buyerName ?? "—"}
                    {t.usedAt ? ` · ${formatManila(t.usedAt)}` : ""}
                  </Text>
                </View>
                <Pill label={ui.label} tone={ui.tone} />
              </View>
            );
          })
        )}
      </Card>
    </>
  );
}

function CancelOrder({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const cancel = useMutation(
    trpc.order.cancel.mutationOptions({
      onSuccess: async () => {
        setNote("");
        Alert.alert("Order cancelled", `Order ${order.code} was cancelled.`);
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.adminList.pathFilter()),
          queryClient.invalidateQueries(trpc.order.adminDetail.pathFilter()),
          queryClient.invalidateQueries(trpc.dashboard.summary.pathFilter()),
        ]);
      },
      onError: async (err) => {
        showError(err);
        await queryClient.invalidateQueries(
          trpc.order.adminDetail.pathFilter(),
        );
      },
    }),
  );

  return (
    <>
      <SectionHeader title="Cancel order" />
      <Card className="gap-3">
        <Text className="text-muted-foreground text-sm">
          Held seats or tier inventory will be released. This cannot be undone.
        </Text>
        <Field
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Reason for cancellation"
          multiline
          maxLength={1000}
        />
        <Button
          label="Cancel order"
          variant="destructive"
          loading={cancel.isPending}
          onPress={() =>
            confirm({
              title: `Cancel order ${order.code}?`,
              message:
                "Held seats or tier inventory will be released. This cannot be undone.",
              confirmLabel: "Cancel order",
              destructive: true,
              onConfirm: () =>
                cancel.mutate({
                  id: order.id,
                  note: note.trim() || undefined,
                }),
            })
          }
        />
      </Card>
    </>
  );
}

function OrderDetail({ code }: { code: string }) {
  const { has } = usePermissions();
  const orderQ = useQuery(trpc.order.adminDetail.queryOptions({ code }));

  if (orderQ.isLoading) return <Loading />;
  const order = orderQ.data;
  if (!order) {
    return (
      <Empty
        title="Order not found"
        hint={orderQ.error ? errorMessage(orderQ.error) : undefined}
      />
    );
  }

  return (
    <ScrollView
      contentContainerClassName="gap-3 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={orderQ.isRefetching}
          onRefresh={() => void orderQ.refetch()}
          tintColor="#2f7de6"
        />
      }
    >
      <Card className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground text-xl font-bold" selectable>
            {order.code}
          </Text>
          <StatusBadge status={order.status} />
        </View>
        <Text className="text-foreground text-2xl font-bold">
          {formatCentavos(order.totalAmount)}
        </Text>
        <Text className="text-muted-foreground text-sm">
          {order.eventTitle ?? "Concert"}
        </Text>
      </Card>

      <SectionHeader title="Payment" />
      <Card>
        <KeyValue label="Total" value={formatCentavos(order.totalAmount)} />
        <KeyValue
          label="HitPay status"
          value={hitpayLabel(order.hitpayStatus)}
        />
        <KeyValue
          label="HitPay payment ID"
          value={order.hitpayPaymentId ?? "—"}
        />
        <KeyValue label="Paid at" value={formatManila(order.paidAt)} />
        {order.status === "pending_payment" ? (
          <KeyValue label="Window ends" value={formatManila(order.expiresAt)} />
        ) : null}
      </Card>

      <SectionHeader title="Timeline" />
      <Timeline order={order} />

      <ItemsBuyerTickets order={order} />

      {order.status === "pending_payment" && has("orders:review") ? (
        <CancelOrder order={order} />
      ) : null}
    </ScrollView>
  );
}

export default function OrderDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <RequirePerm anyOf={["orders:read"]}>
      <Stack.Screen options={{ title: code }} />
      <OrderDetail code={code} />
    </RequirePerm>
  );
}
