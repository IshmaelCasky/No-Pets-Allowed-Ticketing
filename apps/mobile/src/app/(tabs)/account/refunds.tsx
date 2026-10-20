import { Linking, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { Button, Card, Empty, Loading } from "~/components/ui";
import { trpc, trpcClient } from "~/utils/api";
import { formatManila } from "~/utils/format";

type Refund = RouterOutputs["refund"]["myRefunds"][number];

const TONE: Record<Refund["status"], string> = {
  requested: "text-blue-600",
  approved: "text-amber-600",
  rejected: "text-red-600",
  paid: "text-green-600",
};

function RefundCard({ refund }: { refund: Refund }) {
  const viewProof = async () => {
    const { url } = await trpcClient.refund.proofUrl.query({
      refundRequestId: refund.id,
    });
    if (url) void Linking.openURL(url);
  };
  return (
    <Card className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground font-semibold">Refund</Text>
        <Text className={`font-semibold ${TONE[refund.status]}`}>
          {refund.status.toUpperCase()}
        </Text>
      </View>
      <Text className="text-muted-foreground text-sm">{refund.reason}</Text>
      <Text className="text-muted-foreground text-xs">
        Requested {formatManila(refund.createdAt)}
      </Text>
      {refund.status === "rejected" && refund.rejectionReason ? (
        <Text className="text-destructive text-sm">
          {refund.rejectionReason}
        </Text>
      ) : null}
      {refund.status === "paid" ? (
        <View className="gap-1">
          <Text className="text-muted-foreground text-xs">
            Reference: {refund.payoutReference}
          </Text>
          {refund.payoutProofKey ? (
            <Button
              label="View transfer receipt"
              variant="outline"
              onPress={() => void viewProof()}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export default function RefundsScreen() {
  const refundsQ = useQuery(trpc.refund.myRefunds.queryOptions());
  if (refundsQ.isLoading) return <Loading />;
  if (!refundsQ.data || refundsQ.data.length === 0) {
    return <Empty title="No refund requests" />;
  }
  return (
    <ScrollView contentContainerClassName="p-4 gap-3">
      {refundsQ.data.map((r) => (
        <RefundCard key={r.id} refund={r} />
      ))}
    </ScrollView>
  );
}
