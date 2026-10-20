import { useCallback, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ScanResult } from "@npa/validators";

import type { RouterOutputs } from "~/utils/api";
import { Button, Card, Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { usePermissions } from "~/utils/use-permissions";

type ScanResponse = RouterOutputs["scan"]["scan"];

const RESULT_UI: Record<ScanResult, { bg: string; title: string }> = {
  valid: { bg: "bg-green-600", title: "VALID" },
  already_used: { bg: "bg-amber-600", title: "ALREADY USED" },
  wrong_event: { bg: "bg-red-600", title: "WRONG EVENT" },
  void: { bg: "bg-red-600", title: "VOID TICKET" },
  not_found: { bg: "bg-red-600", title: "NOT FOUND" },
};

function ResultOverlay({
  response,
  onClose,
}: {
  response: ScanResponse;
  onClose: () => void;
}) {
  const ui = RESULT_UI[response.result];
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className={`flex-1 items-center justify-center ${ui.bg}`}
      >
        <Text className="text-6xl">
          {response.result === "valid" ? "✓" : "✕"}
        </Text>
        <Text className="text-4xl font-bold text-white">{ui.title}</Text>
        {response.result === "already_used" ? (
          <View className="mt-4 items-center">
            {response.usedAt ? (
              <Text className="text-white">
                Used {new Date(response.usedAt).toLocaleString()}
              </Text>
            ) : null}
            {response.usedByName ? (
              <Text className="text-white">by {response.usedByName}</Text>
            ) : null}
          </View>
        ) : null}
        <Text className="mt-8 text-white/80">Tap to scan next</Text>
      </Pressable>
    </Modal>
  );
}

export default function ScannerScreen() {
  const { has, isLoading: permsLoading } = usePermissions();
  const queryClient = useQueryClient();

  const [permission, requestPermission] = useCameraPermissions();
  const [eventId, setEventId] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const lastScan = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const eventsQ = useQuery(trpc.event.publicList.queryOptions());

  const countQ = useQuery({
    ...trpc.scan.checkInCount.queryOptions({ eventId: eventId ?? "" }),
    enabled: !!eventId,
    refetchInterval: 5000,
  });

  const historyQ = useQuery({
    ...trpc.scan.history.queryOptions({
      eventId: eventId ?? "",
      page: 1,
      pageSize: 20,
    }),
    enabled: !!eventId,
    refetchInterval: 5000,
  });

  const scan = useMutation(
    trpc.scan.scan.mutationOptions({
      onSuccess: async (res) => {
        setResult(res);
        await Haptics.notificationAsync(
          res.result === "valid"
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error,
        );
        if (eventId) {
          void queryClient.invalidateQueries(
            trpc.scan.checkInCount.queryFilter({ eventId }),
          );
          void queryClient.invalidateQueries(
            trpc.scan.history.queryFilter({
              eventId,
              page: 1,
              pageSize: 20,
            }),
          );
        }
      },
    }),
  );

  const doScan = useCallback(
    (rawValue: string) => {
      if (!eventId || !rawValue.trim()) return;
      scan.mutate({ eventId, rawValue: rawValue.trim(), device: "mobile" });
    },
    [eventId, scan],
  );

  const onBarcode = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      // Debounce: ignore the same code within 2.5s, and block while overlay open.
      if (result) return;
      if (data === lastScan.current.value && now - lastScan.current.at < 2500) {
        return;
      }
      lastScan.current = { value: data, at: now };
      doScan(data);
    },
    [doScan, result],
  );

  if (permsLoading) return <Loading />;
  if (!has("tickets:scan")) {
    return <Empty title="Scanner unavailable" hint="You lack scan access." />;
  }

  // Event picker first.
  if (!eventId) {
    if (eventsQ.isLoading) return <Loading />;
    return (
      <ScrollView contentContainerClassName="p-4 gap-3">
        <Text className="text-foreground text-lg font-bold">
          Select an event to scan
        </Text>
        {(eventsQ.data ?? []).map((e) => (
          <Pressable key={e.id} onPress={() => setEventId(e.id)}>
            <Card>
              <Text className="text-foreground font-semibold">{e.title}</Text>
              <Text className="text-muted-foreground text-sm">{e.venue}</Text>
            </Card>
          </Pressable>
        ))}
        {eventsQ.data?.length === 0 ? (
          <Empty title="No events to scan" />
        ) : null}
      </ScrollView>
    );
  }

  const selectedEvent = eventsQ.data?.find((e) => e.id === eventId);

  return (
    <View className="flex-1">
      {result ? (
        <ResultOverlay response={result} onClose={() => setResult(null)} />
      ) : null}

      <View className="flex-row items-center justify-between p-3">
        <Pressable onPress={() => setEventId(null)}>
          <Text className="text-primary font-semibold">‹ Events</Text>
        </Pressable>
        <Text
          className="text-foreground flex-1 text-center font-bold"
          numberOfLines={1}
        >
          {selectedEvent?.title}
        </Text>
        <Text className="text-primary font-bold">
          {countQ.data ? `${countQ.data.checkedIn}/${countQ.data.total}` : "—"}
        </Text>
      </View>

      {/* Camera */}
      <View className="h-72 overflow-hidden">
        {!permission?.granted ? (
          <View className="flex-1 items-center justify-center gap-3 p-4">
            <Text className="text-muted-foreground text-center">
              Camera access is needed to scan tickets.
            </Text>
            <Button
              label="Grant camera access"
              onPress={() => void requestPermission()}
            />
          </View>
        ) : (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={result ? undefined : onBarcode}
          />
        )}
      </View>

      <ScrollView contentContainerClassName="p-4 gap-4">
        {/* Manual entry */}
        <Card className="gap-2">
          <Text className="text-foreground font-semibold">
            Manual code entry
          </Text>
          <TextInput
            value={manual}
            onChangeText={setManual}
            placeholder="Paste or type ticket code"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            className="border-border bg-input text-foreground rounded-lg border px-3 py-3"
          />
          <Button
            label="Check code"
            loading={scan.isPending}
            onPress={() => {
              doScan(manual);
              setManual("");
            }}
          />
        </Card>

        {/* History */}
        <View className="gap-2">
          <Text className="text-muted-foreground text-xs font-semibold uppercase">
            Recent scans
          </Text>
          {(historyQ.data?.items ?? []).map((log) => (
            <Card key={log.id} className="flex-row justify-between">
              <Text className="text-foreground text-sm">{log.result}</Text>
              <Text className="text-muted-foreground text-xs">
                {new Date(log.createdAt).toLocaleTimeString()}
              </Text>
            </Card>
          ))}
          {historyQ.data?.items.length === 0 ? (
            <Text className="text-muted-foreground text-sm">No scans yet.</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
