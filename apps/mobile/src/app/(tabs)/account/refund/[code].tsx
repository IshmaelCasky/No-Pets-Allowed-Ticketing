import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestRefundSchema } from "@npa/validators";

import { Button, Card, Empty, Field, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";

export default function RequestRefund() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const orderQ = useQuery(trpc.order.byCode.queryOptions({ code }));
  const order = orderQ.data;

  const [reason, setReason] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutAccountName, setPayoutAccountName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const request = useMutation(
    trpc.refund.request.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.refund.myRefunds.queryFilter());
        router.replace("/(tabs)/account/refunds");
      },
      onError: (e) => setError(e.message),
    }),
  );

  if (orderQ.isLoading) return <Loading />;
  if (!order) return <Empty title="Order not found" />;
  if (order.status !== "approved") {
    return (
      <Empty
        title="Not refundable"
        hint="Only approved orders can be refunded."
      />
    );
  }

  const submit = () => {
    setError(null);
    const parsed = requestRefundSchema.safeParse({
      orderId: order.id,
      reason,
      payoutMethod,
      payoutAccountName,
      payoutAccountNumber,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the form");
      return;
    }
    request.mutate(parsed.data);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView contentContainerClassName="p-4 gap-4 pb-28">
        <Stack.Screen options={{ title: `Refund · ${order.code}` }} />
        <Card>
          <Text className="text-muted-foreground text-sm">
            Refunds are manual: once approved, staff send the payout to the
            account you provide and upload the transfer receipt. Used tickets
            cannot be refunded, and only one open request is allowed per order.
          </Text>
        </Card>

        <Field
          label="Reason"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={3}
          placeholder="Why are you requesting a refund?"
        />
        <Field
          label="Payout method"
          value={payoutMethod}
          onChangeText={setPayoutMethod}
          placeholder="e.g. GCash, Maya, Bank"
        />
        <Field
          label="Account name"
          value={payoutAccountName}
          onChangeText={setPayoutAccountName}
          placeholder="Account holder name"
        />
        <Field
          label="Account number"
          value={payoutAccountNumber}
          onChangeText={setPayoutAccountNumber}
          placeholder="Account / mobile number"
        />
        {error ? (
          <Text className="text-destructive text-sm">{error}</Text>
        ) : null}
        <Button
          label="Submit refund request"
          onPress={submit}
          loading={request.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
