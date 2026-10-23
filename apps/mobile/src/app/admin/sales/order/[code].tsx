import { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Tone } from "~/components/admin";
import type { RouterOutputs } from "~/utils/api";
import { KeyValue, Pill, RequirePerm, SectionHeader } from "~/components/admin";
import { useConcertTitles } from "~/components/ops/hooks";
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

type Order = NonNullable<RouterOutputs["order"]["byCode"]>;
type Ticket = NonNullable<RouterOutputs["user"]["byId"]>["tickets"][number];

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

/** Buyer + tickets need `users:read` (no admin order-detail endpoint yet). */
function BuyerAndTickets({ order }: { order: Order }) {
  const userQ = useQuery(trpc.user.byId.queryOptions({ id: order.userId }));
  const tickets = useMemo(
    () => (userQ.data?.tickets ?? []).filter((t) => t.orderId === order.id),
    [userQ.data, order.id],
  );
  const hasSeats = tickets.some((t) => t.seatId);
  const tiersQ = useQuery(
    trpc.event.tiersByEvent.queryOptions({ eventId: order.eventId }),
  );
  const seatsQ = useQuery({
    ...trpc.seatMap.forEvent.queryOptions({ eventId: order.eventId }),
    enabled: hasSeats,
  });
  const tierName = useMemo(
    () => new Map((tiersQ.data ?? []).map((t) => [t.id, t.name])),
    [tiersQ.data],
  );
  const seatLabel = useMemo(
    () => new Map((seatsQ.data?.seats ?? []).map((s) => [s.id, s.label])),
    [seatsQ.data],
  );

  if (userQ.isLoading) return <Loading />;
  const buyer = userQ.data;

  return (
    <>
      <SectionHeader title="Buyer" />
      <Card>
        {buyer ? (
          <>
            <KeyValue label="Name" value={buyer.name} />
            <KeyValue label="Email" value={buyer.email} />
            {buyer.phone ? (
              <KeyValue label="Phone" value={buyer.phone} />
            ) : null}
          </>
        ) : (
          <Text className="text-muted-foreground text-sm">
            {userQ.error ? errorMessage(userQ.error) : "Buyer not found."}
          </Text>
        )}
      </Card>

      <SectionHeader title={`Tickets (${tickets.length})`} />
      <Card className="gap-3">
        {tickets.length === 0 ? (
          <Text className="text-muted-foreground text-sm">
            {order.status === "pending_payment"
              ? "Tickets are issued once HitPay confirms the payment."
              : "No tickets for this order."}
          </Text>
        ) : (
          tickets.map((t) => {
            const ui = TICKET_UI[t.status];
            const label =
              (t.seatId ? seatLabel.get(t.seatId) : undefined) ??
              (t.tierId ? tierName.get(t.tierId) : undefined) ??
              "Ticket";
            return (
              <View key={t.id} className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-semibold">
                    {label}
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    {t.holderName ?? buyer?.name ?? "—"}
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
          queryClient.invalidateQueries(trpc.order.byCode.pathFilter()),
          queryClient.invalidateQueries(trpc.dashboard.summary.pathFilter()),
          queryClient.invalidateQueries(trpc.user.byId.pathFilter()),
        ]);
      },
      onError: async (err) => {
        showError(err);
        await queryClient.invalidateQueries(trpc.order.byCode.pathFilter());
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
  const concerts = useConcertTitles();
  const orderQ = useQuery(trpc.order.byCode.queryOptions({ code }));

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
          tintColor="#c03484"
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
          {concerts.titles.get(order.eventId) ?? "Concert"}
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

      {has("users:read") ? (
        <BuyerAndTickets order={order} />
      ) : (
        <Text className="text-muted-foreground text-xs">
          Buyer and ticket details need the Users permission.
        </Text>
      )}

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
