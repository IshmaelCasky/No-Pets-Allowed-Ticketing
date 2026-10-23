import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { markRefundPaidSchema, rejectRefundSchema } from "@npa/validators";

import type { Refund } from "~/components/ops/sales/use-refund";
import {
  KeyValue,
  ListRow,
  Pill,
  RequirePerm,
  SectionHeader,
} from "~/components/admin";
import { useConcertTitles } from "~/components/ops/hooks";
import { ReasonSheet } from "~/components/ops/reason-sheet";
import { ProofButton } from "~/components/ops/sales/proof-viewer";
import { useRefund } from "~/components/ops/sales/use-refund";
import {
  REFUND_STATUS_LABEL,
  REFUND_STATUS_TONE,
} from "~/components/ops/status";
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  StatusBadge,
} from "~/components/ui";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { confirm, errorMessage, showError } from "~/utils/feedback";
import { formatCentavos, formatManila } from "~/utils/format";
import { useImageUploader } from "~/utils/uploadthing";
import { usePermissions } from "~/utils/use-permissions";

/** tRPC CONFLICT = someone else already reviewed / paid it. */
function isConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const data = (err as { data?: { code?: unknown } | null }).data;
  return data?.code === "CONFLICT";
}

/** Order + buyer for a refund. Needs `users:read` (queue rows only carry ids). */
function OrderSummary({ refund }: { refund: Refund }) {
  const router = useRouter();
  const { has } = usePermissions();
  const concerts = useConcertTitles();
  const userQ = useQuery({
    ...trpc.user.byId.queryOptions({ id: refund.userId }),
    enabled: has("users:read"),
  });

  if (!has("users:read")) {
    return (
      <Card>
        <Text className="text-muted-foreground text-sm">
          Order and buyer details need the Users permission.
        </Text>
      </Card>
    );
  }
  if (userQ.isLoading) return <Loading />;
  const buyer = userQ.data;
  const order = buyer?.orders.find((o) => o.id === refund.orderId);

  return (
    <>
      {order ? (
        <ListRow
          title={order.code}
          subtitle={`${formatCentavos(order.totalAmount)} · ${
            concerts.titles.get(order.eventId) ?? "Concert"
          }`}
          meta={`Bought ${formatManila(order.createdAt)}`}
          right={<StatusBadge status={order.status} />}
          onPress={
            has("orders:read")
              ? () => router.push(`/admin/sales/order/${order.code}`)
              : undefined
          }
        />
      ) : null}
      <Card>
        <KeyValue label="Buyer" value={buyer?.name ?? "—"} />
        <KeyValue label="Email" value={buyer?.email ?? "—"} />
        {userQ.error ? (
          <Text className="text-destructive text-xs">
            {errorMessage(userQ.error)}
          </Text>
        ) : null}
      </Card>
    </>
  );
}

function MarkPaid({
  refund,
  onDone,
}: {
  refund: Refund;
  onDone: (row: Refund) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [payoutReference, setPayoutReference] = useState("");
  const [proof, setProof] = useState<{ key: string; name: string } | null>(
    null,
  );

  const { openImagePicker, isUploading } = useImageUploader("refundProof", {
    headers: () => ({ Cookie: authClient.getCookie() }),
    onUploadError: (err) => showError(err, "Upload failed"),
  });

  const pick = async (source: "library" | "camera") => {
    try {
      const res = await openImagePicker({
        source,
        quality: 0.7,
        onInsufficientPermissions: () =>
          Alert.alert(
            "Permission needed",
            source === "camera"
              ? "Allow camera access to photograph the receipt."
              : "Allow photo access to choose the receipt.",
          ),
      });
      const file = res?.[0];
      if (file) setProof({ key: file.key, name: file.name });
    } catch (err) {
      showError(err, "Upload failed");
    }
  };

  const markPaid = useMutation(
    trpc.refund.markPaid.mutationOptions({
      onSuccess: async (row) => {
        Alert.alert("Refund marked as paid", "The order is now refunded.");
        await onDone(row);
      },
      onError: async (err) => {
        if (isConflict(err)) {
          Alert.alert(
            "Already handled",
            "Only an approved refund can be marked paid.",
          );
          await queryClient.invalidateQueries(trpc.refund.queue.pathFilter());
        } else {
          showError(err);
        }
      },
    }),
  );

  const submit = () => {
    const parsed = markRefundPaidSchema.safeParse({
      refundRequestId: refund.id,
      payoutReference,
      payoutProofKey: proof?.key ?? "",
    });
    if (!parsed.success) {
      Alert.alert(
        "Missing details",
        "Upload the transfer receipt and enter the payout reference.",
      );
      return;
    }
    confirm({
      title: "Mark refund as paid?",
      message: `The order becomes refunded and the customer is emailed reference ${parsed.data.payoutReference}.`,
      confirmLabel: "Mark as paid",
      onConfirm: () => markPaid.mutate(parsed.data),
    });
  };

  return (
    <>
      <SectionHeader title="Mark as paid" />
      <Card className="gap-3">
        <Text className="text-muted-foreground text-sm">
          Send the money to the payout account above, then upload the transfer
          receipt and enter the payout reference.
        </Text>
        <Text className="text-foreground text-sm font-medium">
          Transfer receipt
        </Text>
        {proof ? (
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-foreground flex-1 text-sm" numberOfLines={1}>
              ✓ {proof.name}
            </Text>
            <Pill label="Uploaded" tone="green" />
          </View>
        ) : null}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              label={proof ? "Replace photo" : "Choose photo"}
              variant="outline"
              loading={isUploading}
              onPress={() => void pick("library")}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Take photo"
              variant="outline"
              disabled={isUploading}
              onPress={() => void pick("camera")}
            />
          </View>
        </View>
        <Field
          label="Payout reference #"
          value={payoutReference}
          onChangeText={setPayoutReference}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={120}
        />
        <Button
          label="Mark as paid"
          loading={markPaid.isPending}
          disabled={
            isUploading ||
            markPaid.isPending ||
            !proof ||
            payoutReference.trim() === ""
          }
          onPress={submit}
        />
      </Card>
    </>
  );
}

function RefundDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const refundQ = useRefund(id);
  const [rejecting, setRejecting] = useState(false);

  const refresh = async (row?: Refund) => {
    if (row) refundQ.setRefund(row);
    await Promise.all([
      queryClient.invalidateQueries(trpc.refund.queue.pathFilter()),
      queryClient.invalidateQueries(trpc.order.adminList.pathFilter()),
      queryClient.invalidateQueries(trpc.order.byCode.pathFilter()),
      queryClient.invalidateQueries(trpc.user.byId.pathFilter()),
      queryClient.invalidateQueries(trpc.dashboard.summary.pathFilter()),
    ]);
  };

  const onConflict = async () => {
    Alert.alert("Already reviewed", "This refund was already reviewed.");
    await refresh();
  };

  const approve = useMutation(
    trpc.refund.approve.mutationOptions({
      onSuccess: async (row) => {
        Alert.alert("Refund approved", "Tickets voided. Send the payout next.");
        await refresh(row);
      },
      onError: async (err) => {
        if (isConflict(err)) await onConflict();
        else showError(err);
      },
    }),
  );

  const reject = useMutation(
    trpc.refund.reject.mutationOptions({
      onSuccess: async (row) => {
        setRejecting(false);
        Alert.alert("Refund rejected", "The customer has been emailed.");
        await refresh(row);
      },
      onError: async (err) => {
        if (isConflict(err)) {
          setRejecting(false);
          await onConflict();
        } else {
          showError(err);
        }
      },
    }),
  );

  if (refundQ.isLoading) return <Loading />;
  const refund = refundQ.data;
  if (!refund) {
    return (
      <Empty
        title="Refund request not found"
        hint={refundQ.error ? errorMessage(refundQ.error) : undefined}
      />
    );
  }

  const busy = approve.isPending || reject.isPending;

  return (
    <ScrollView
      contentContainerClassName="gap-3 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refundQ.isRefetching}
          onRefresh={() => void refundQ.refetch()}
          tintColor="#c03484"
        />
      }
    >
      <Card className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground text-lg font-bold">
            Refund request
          </Text>
          <Pill
            label={REFUND_STATUS_LABEL[refund.status]}
            tone={REFUND_STATUS_TONE[refund.status]}
          />
        </View>
        <KeyValue label="Requested" value={formatManila(refund.createdAt)} />
        {refund.reviewedAt ? (
          <KeyValue label="Reviewed" value={formatManila(refund.reviewedAt)} />
        ) : null}
        {refund.paidAt ? (
          <KeyValue label="Paid" value={formatManila(refund.paidAt)} />
        ) : null}
      </Card>

      <SectionHeader title="Reason" />
      <Card>
        <Text className="text-foreground text-sm" selectable>
          {refund.reason}
        </Text>
      </Card>

      <SectionHeader title="Order" />
      <OrderSummary refund={refund} />

      <SectionHeader title="Payout details" />
      <Card>
        <KeyValue label="Method" value={refund.payoutMethod} />
        <KeyValue label="Account name" value={refund.payoutAccountName} />
        <KeyValue
          label="Account number"
          value={
            <Text
              className="text-foreground font-mono text-base font-semibold"
              selectable
            >
              {refund.payoutAccountNumber}
            </Text>
          }
        />
        {refund.payoutReference ? (
          <KeyValue
            label="Payout reference"
            value={
              <Text className="text-foreground font-mono text-sm" selectable>
                {refund.payoutReference}
              </Text>
            }
          />
        ) : null}
      </Card>

      {refund.status === "rejected" && refund.rejectionReason ? (
        <>
          <SectionHeader title="Rejection reason" />
          <Card>
            <Text className="text-foreground text-sm">
              {refund.rejectionReason}
            </Text>
          </Card>
        </>
      ) : null}

      {refund.payoutProofKey ? (
        <ProofButton refundRequestId={refund.id} />
      ) : null}

      {refund.status === "requested" ? (
        <View className="gap-2 pt-2">
          <Button
            label="Approve refund"
            loading={approve.isPending}
            disabled={busy}
            onPress={() =>
              confirm({
                title: "Approve refund?",
                message:
                  "The order's tickets are voided immediately and their seats / tier inventory released. Then send the payout and mark it paid.",
                confirmLabel: "Approve",
                destructive: true,
                onConfirm: () => approve.mutate({ refundRequestId: refund.id }),
              })
            }
          />
          <Button
            label="Reject"
            variant="destructive"
            disabled={busy}
            onPress={() => setRejecting(true)}
          />
        </View>
      ) : null}

      {refund.status === "approved" ? (
        <MarkPaid refund={refund} onDone={refresh} />
      ) : null}

      <ReasonSheet
        visible={rejecting}
        title="Reject refund request"
        description="A reason is required. Tickets are left untouched."
        label="Reason"
        placeholder="Why is this refund rejected?"
        submitLabel="Reject refund"
        destructive
        loading={reject.isPending}
        validate={(reason) => {
          const parsed = rejectRefundSchema.safeParse({
            refundRequestId: refund.id,
            reason,
          });
          return parsed.success
            ? null
            : (parsed.error.issues[0]?.message ??
                "A rejection reason is required");
        }}
        onSubmit={(reason) =>
          reject.mutate({ refundRequestId: refund.id, reason })
        }
        onClose={() => setRejecting(false)}
      />
    </ScrollView>
  );
}

export default function RefundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequirePerm anyOf={["refunds:review"]}>
      <RefundDetail id={id} />
    </RequirePerm>
  );
}
