import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { Button, Card, Empty, Field, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { countdownMMSS, formatCentavos } from "~/utils/format";
import { useImageUploader } from "~/utils/uploadthing";

type PaymentMethod = RouterOutputs["paymentMethod"]["listActive"][number];

function Countdown({ expiresAt }: { expiresAt: Date | string | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const label = countdownMMSS(expiresAt);
  const done = label === "00:00";
  return (
    <Card className={done ? "border-destructive" : "border-primary"}>
      <Text className="text-muted-foreground text-xs">
        {done ? "Payment window closed" : "Time left to pay"}
      </Text>
      <Text
        className={`text-3xl font-bold ${done ? "text-destructive" : "text-primary"}`}
      >
        {label}
      </Text>
    </Card>
  );
}

function MethodPanel({
  method,
  amount,
}: {
  method: PaymentMethod;
  amount: number;
}) {
  const saveQr = async () => {
    if (!method.qrImageUrl) return;
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo access to save the QR.");
        return;
      }
      const target = `${FileSystem.cacheDirectory}npa-qr-${method.id}.png`;
      const { uri } = await FileSystem.downloadAsync(method.qrImageUrl, target);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved", "Payment QR saved to your gallery.");
    } catch {
      Alert.alert("Could not save", "Please try again.");
    }
  };

  return (
    <Card className="gap-3">
      <Text className="text-foreground font-semibold">{method.label}</Text>
      {method.qrImageUrl ? (
        <Pressable onLongPress={saveQr}>
          <Image
            source={{ uri: method.qrImageUrl }}
            className="h-56 w-full rounded-lg"
            resizeMode="contain"
          />
          <Text className="text-muted-foreground mt-1 text-center text-xs">
            Long-press the QR to save it
          </Text>
        </Pressable>
      ) : null}
      <View className="gap-0.5">
        {method.accountName ? (
          <Text className="text-foreground">Name: {method.accountName}</Text>
        ) : null}
        {method.accountNumber ? (
          <Text className="text-foreground">
            Account: {method.accountNumber}
          </Text>
        ) : null}
        {method.instructions ? (
          <Text className="text-muted-foreground text-sm">
            {method.instructions}
          </Text>
        ) : null}
      </View>
      <View className="bg-secondary rounded-lg p-3">
        <Text className="text-muted-foreground text-xs">Pay exactly</Text>
        <Text className="text-primary text-2xl font-bold">
          {formatCentavos(amount)}
        </Text>
      </View>
      {method.qrImageUrl ? (
        <Button label="Save QR to gallery" variant="outline" onPress={saveQr} />
      ) : null}
    </Card>
  );
}

export default function PayScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const orderQ = useQuery(trpc.order.byCode.queryOptions({ code }));
  const methodsQ = useQuery(trpc.paymentMethod.listActive.queryOptions());

  const [methodId, setMethodId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { openImagePicker, isUploading } = useImageUploader("paymentProof", {
    onClientUploadComplete: (res) => {
      const key = res[0]?.key;
      if (key) setProofKey(key);
    },
    onUploadError: () => setError("Upload failed. Try another image."),
  });

  const submitProof = useMutation(
    trpc.order.submitProof.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.order.myOrders.queryFilter());
        router.replace("/(tabs)/tickets");
      },
      onError: (e) => setError(e.message),
    }),
  );

  const order = orderQ.data;
  const selectedMethod = useMemo(
    () => methodsQ.data?.find((m) => m.id === methodId) ?? methodsQ.data?.[0],
    [methodsQ.data, methodId],
  );

  if (orderQ.isLoading || methodsQ.isLoading) return <Loading />;
  if (!order) return <Empty title="Order not found" />;

  const canSubmit =
    (order.status === "pending_payment" || order.status === "rejected") &&
    !!order.expiresAt &&
    new Date(order.expiresAt) > new Date();

  const submit = () => {
    setError(null);
    if (!selectedMethod) return setError("Choose a payment method");
    if (!reference.trim()) return setError("Enter the reference number");
    if (!proofKey) return setError("Upload your payment receipt");
    submitProof.mutate({
      orderId: order.id,
      paymentMethodId: selectedMethod.id,
      referenceNumber: reference.trim(),
      proofImageKey: proofKey,
    });
  };

  return (
    <ScrollView contentContainerClassName="p-4 gap-4 pb-28">
      <Stack.Screen options={{ title: `Pay · ${order.code}` }} />

      <Countdown expiresAt={order.expiresAt} />

      {order.status === "rejected" ? (
        <Card className="border-destructive gap-1">
          <Text className="text-destructive font-semibold">
            Previous proof rejected
          </Text>
          {order.rejectionReason ? (
            <Text className="text-muted-foreground text-sm">
              {order.rejectionReason}
            </Text>
          ) : null}
          <Text className="text-muted-foreground text-xs">
            You may re-upload once before the window closes.
          </Text>
        </Card>
      ) : null}

      {/* Payment-method tabs */}
      <View className="flex-row flex-wrap gap-2">
        {methodsQ.data?.map((m, i) => {
          const active = (methodId ?? (i === 0 ? m.id : undefined)) === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => setMethodId(m.id)}
              className={`rounded-full px-4 py-2 ${active ? "bg-primary" : "bg-secondary"}`}
            >
              <Text
                className={
                  active ? "text-primary-foreground" : "text-foreground"
                }
              >
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedMethod ? (
        <MethodPanel method={selectedMethod} amount={order.totalAmount} />
      ) : (
        <Empty title="No payment methods available" />
      )}

      {canSubmit ? (
        <Card className="gap-3">
          <Text className="text-foreground font-semibold">Upload proof</Text>
          <Button
            label={
              proofKey
                ? "Receipt uploaded ✓"
                : isUploading
                  ? "Uploading…"
                  : "Upload receipt image"
            }
            variant={proofKey ? "secondary" : "outline"}
            loading={isUploading}
            onPress={() => void openImagePicker({ source: "library" })}
          />
          <Field
            label="Reference number"
            value={reference}
            onChangeText={setReference}
            placeholder="e.g. 0123 4567 8901"
            autoCapitalize="characters"
          />
          {error ? (
            <Text className="text-destructive text-sm">{error}</Text>
          ) : null}
          <Button
            label="Submit for review"
            onPress={submit}
            loading={submitProof.isPending}
          />
        </Card>
      ) : (
        <Card>
          <Text className="text-muted-foreground">
            This order is no longer awaiting payment.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}
