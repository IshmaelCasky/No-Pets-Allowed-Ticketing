/**
 * Gate → Scanner. Camera QR scanning (debounced) + manual entry for the
 * selected concert, full-screen green / amber / red result with haptics, live
 * check-in counter and the latest scans. Online only (no offline scanning).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
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
import { Pill, SectionHeader } from "~/components/admin";
import { Button, Card, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { showError } from "~/utils/feedback";
import { formatManila } from "~/utils/format";
import { manilaTime } from "../format";
import { useScreenFocused } from "../hooks";
import { SCAN_RESULT_LABEL, SCAN_RESULT_TONE } from "../status";
import { ConcertBar } from "./concert";

type ScanResponse = RouterOutputs["scan"]["scan"];

/** Ignore the same code until it has been out of view this long (ms). */
const DUP_WINDOW_MS = 3000;
/** Valid results clear themselves; failures wait for a tap. */
const VALID_DISMISS_MS = 2000;
const RECENT_PAGE = { page: 1, pageSize: 8 } as const;

const RESULT_UI: Record<
  ScanResult,
  { bg: string; glyph: string; title: string; hint: string | null }
> = {
  valid: { bg: "bg-green-600", glyph: "✓", title: "VALID", hint: null },
  already_used: {
    bg: "bg-amber-600",
    glyph: "!",
    title: "ALREADY USED",
    hint: null,
  },
  wrong_event: {
    bg: "bg-red-600",
    glyph: "✕",
    title: "WRONG CONCERT",
    hint: "This ticket is for a different concert.",
  },
  void: {
    bg: "bg-red-600",
    glyph: "✕",
    title: "VOID TICKET",
    hint: "This ticket was voided (refunded or cancelled).",
  },
  not_found: {
    bg: "bg-red-600",
    glyph: "✕",
    title: "NOT FOUND",
    hint: "Not a No Pets Allowed ticket code.",
  },
};

function ResultOverlay({
  response,
  ticketLabel,
  onClose,
}: {
  response: ScanResponse;
  ticketLabel: string | null;
  onClose: () => void;
}) {
  const ui = RESULT_UI[response.result];
  const holder = response.ticket?.holderName;

  useEffect(() => {
    if (response.result !== "valid") return;
    const t = setTimeout(onClose, VALID_DISMISS_MS);
    return () => clearTimeout(t);
  }, [response, onClose]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        onPress={onClose}
        className={`flex-1 items-center justify-center gap-3 p-6 ${ui.bg}`}
      >
        <Text className="text-8xl font-black text-white">{ui.glyph}</Text>
        <Text className="text-center text-4xl font-black text-white">
          {ui.title}
        </Text>
        {ticketLabel ? (
          <Text className="text-center text-3xl font-bold text-white">
            {ticketLabel}
          </Text>
        ) : null}
        {holder ? (
          <Text className="text-center text-xl text-white">{holder}</Text>
        ) : null}
        {response.result === "already_used" ? (
          <View className="items-center rounded-xl bg-black/20 px-4 py-3">
            <Text className="text-center text-lg font-semibold text-white">
              Used {formatManila(response.usedAt)}
            </Text>
            {response.usedByName ? (
              <Text className="text-center text-lg text-white">
                by {response.usedByName}
              </Text>
            ) : null}
          </View>
        ) : null}
        {ui.hint ? (
          <Text className="text-center text-lg text-white">{ui.hint}</Text>
        ) : null}
        <Text className="mt-8 text-base text-white/80">
          {response.result === "valid"
            ? "Next scan in a moment…"
            : "Tap to scan next"}
        </Text>
      </Pressable>
    </Modal>
  );
}

function CameraPanel({
  paused,
  onCode,
}: {
  paused: boolean;
  onCode: (value: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return (
      <View className="h-72 items-center justify-center">
        <Loading />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View className="h-72 items-center justify-center gap-3 p-4">
        <Text className="text-muted-foreground text-center">
          Camera access is needed to scan tickets.
        </Text>
        {permission.canAskAgain ? (
          <Button
            label="Allow camera"
            onPress={() => void requestPermission()}
          />
        ) : (
          <Button
            label="Open Settings"
            variant="outline"
            onPress={() => void Linking.openSettings()}
          />
        )}
      </View>
    );
  }
  return (
    <View className="h-80 overflow-hidden bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={paused ? undefined : ({ data }) => onCode(data)}
      />
      {/* Aim guide */}
      <View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
      >
        <View className="h-52 w-52 rounded-2xl border-4 border-white/70" />
      </View>
    </View>
  );
}

export function ScannerView({
  eventId,
  onChangeConcert,
}: {
  eventId: string;
  onChangeConcert: (eventId: string) => void;
}) {
  const queryClient = useQueryClient();
  const focused = useScreenFocused();
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const lastScan = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const countQ = useQuery({
    ...trpc.scan.checkInCount.queryOptions({ eventId }),
    refetchInterval: focused ? 5000 : false,
  });
  const recentQ = useQuery({
    ...trpc.scan.logs.queryOptions({ eventId, ...RECENT_PAGE }),
    refetchInterval: focused ? 5000 : false,
  });

  // Tier names for the result overlay (a public read).
  const tiersQ = useQuery(trpc.event.tiersByEvent.queryOptions({ eventId }));
  const labelFor = useMemo(() => {
    const tiers = new Map((tiersQ.data ?? []).map((t) => [t.id, t.name]));
    return (ticket: ScanResponse["ticket"]): string | null => {
      if (!ticket) return null;
      if (ticket.tierId) return tiers.get(ticket.tierId) ?? null;
      return null;
    };
  }, [tiersQ.data]);

  const scan = useMutation(
    trpc.scan.scan.mutationOptions({
      onSuccess: (res) => {
        setResult(res);
        void Haptics.notificationAsync(
          res.result === "valid"
            ? Haptics.NotificationFeedbackType.Success
            : res.result === "already_used"
              ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Error,
        );
        void queryClient.invalidateQueries(
          trpc.scan.checkInCount.queryFilter({ eventId }),
        );
        void queryClient.invalidateQueries(trpc.scan.logs.pathFilter());
        void queryClient.invalidateQueries(trpc.scan.checkins.pathFilter());
        void queryClient.invalidateQueries(trpc.dashboard.summary.pathFilter());
      },
      onError: (err) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showError(err, "Scan failed");
      },
    }),
  );

  const paused = result !== null || scan.isPending;

  const doScan = useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (!value || scan.isPending) return;
      scan.mutate({ eventId, rawValue: value, device: "mobile" });
    },
    [eventId, scan],
  );

  const onCode = useCallback(
    (data: string) => {
      const now = Date.now();
      const prev = lastScan.current;
      if (data === prev.value && now - prev.at < DUP_WINDOW_MS) {
        // Still in view — keep suppressing until it leaves the frame.
        lastScan.current = { value: data, at: now };
        return;
      }
      lastScan.current = { value: data, at: now };
      doScan(data);
    },
    [doScan],
  );

  const closeResult = useCallback(() => {
    // Restart the duplicate window so the code still in frame isn't re-sent.
    lastScan.current = { ...lastScan.current, at: Date.now() };
    setResult(null);
  }, []);

  const submitManual = () => {
    if (!manual.trim()) return;
    doScan(manual);
    setManual("");
  };

  const count = countQ.data;
  const recent = recentQ.data?.items ?? [];

  return (
    <View className="flex-1">
      {result ? (
        <ResultOverlay
          response={result}
          ticketLabel={labelFor(result.ticket)}
          onClose={closeResult}
        />
      ) : null}

      <ConcertBar
        eventId={eventId}
        onChange={onChangeConcert}
        right={
          <View className="items-end">
            <Text className="text-muted-foreground text-xs">Checked in</Text>
            <Text className="text-primary text-lg font-bold">
              {count ? `${count.checkedIn} / ${count.total}` : "—"}
            </Text>
          </View>
        }
      />

      <ScrollView
        contentContainerClassName="pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Camera is mounted only while this screen is focused. */}
        {focused ? (
          <CameraPanel paused={paused} onCode={onCode} />
        ) : (
          <View className="h-80 bg-black" />
        )}

        <View className="gap-4 p-4">
          <Card className="gap-2">
            <Text className="text-foreground font-semibold">
              Manual code entry
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                value={manual}
                onChangeText={setManual}
                onSubmitEditing={submitManual}
                placeholder="Paste or type ticket code"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                className="border-border bg-input text-foreground flex-1 rounded-lg border px-3 py-3"
              />
              <Button
                label="Check"
                loading={scan.isPending}
                disabled={!manual.trim() || scan.isPending}
                onPress={submitManual}
              />
            </View>
          </Card>

          <View className="gap-2">
            <SectionHeader title="Recent scans" />
            {recent.length === 0 ? (
              <Text className="text-muted-foreground text-sm">
                {recentQ.isLoading ? "Loading…" : "No scans yet."}
              </Text>
            ) : (
              recent.map((log) => (
                <View
                  key={log.id}
                  className="border-border bg-card flex-row items-center gap-3 rounded-xl border px-3 py-2.5"
                >
                  <Pill
                    label={SCAN_RESULT_LABEL[log.result]}
                    tone={SCAN_RESULT_TONE[log.result]}
                  />
                  <View className="flex-1">
                    <Text
                      className="text-foreground text-sm font-medium"
                      numberOfLines={1}
                    >
                      {log.holderName ??
                        log.buyerName ??
                        (log.rawValuePreview ? "Unknown code" : "—")}
                    </Text>
                    <Text
                      className="text-muted-foreground text-xs"
                      numberOfLines={1}
                    >
                      {[log.tierName, log.scannedByName]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    {manilaTime(log.createdAt)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
