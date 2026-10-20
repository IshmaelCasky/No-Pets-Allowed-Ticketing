import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Brightness from "expo-brightness";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Card, Empty, Field, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();

  const ticketQ = useQuery(trpc.ticket.byId.queryOptions({ id }));
  const ticket = ticketQ.data;

  const mapQ = useQuery({
    ...trpc.seatMap.forEvent.queryOptions({ eventId: ticket?.eventId ?? "" }),
    enabled: !!ticket?.seatId,
  });

  const seatId = ticket?.seatId;
  const seatLabel = useMemo(() => {
    if (!seatId) return null;
    return mapQ.data?.seats.find((s) => s.id === seatId)?.label ?? null;
  }, [seatId, mapQ.data]);

  // `editing` holds the draft name while the sheet is open (null = not editing).
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const [error, setError] = useState<string | null>(null);

  // Boost brightness while the QR is on screen; restore on leave.
  useEffect(() => {
    let previous: number | null = null;
    void (async () => {
      try {
        const { granted } = await Brightness.requestPermissionsAsync();
        if (!granted) return;
        previous = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      if (previous != null) {
        void Brightness.setBrightnessAsync(previous).catch(() => undefined);
      }
    };
  }, []);

  const updateHolder = useMutation(
    trpc.ticket.updateHolder.mutationOptions({
      onSuccess: () => {
        setDraft(null);
        void queryClient.invalidateQueries(trpc.ticket.byId.queryFilter());
        void queryClient.invalidateQueries(trpc.ticket.myTickets.queryFilter());
      },
      onError: (e) => setError(e.message),
    }),
  );

  if (ticketQ.isLoading) return <Loading />;
  if (!ticket) return <Empty title="Ticket not found" />;

  const qrSize = Math.min(width - 80, 300);
  const faded = ticket.status !== "active";

  return (
    <ScrollView contentContainerClassName="p-6 gap-5 items-center">
      <Stack.Screen options={{ title: "Ticket" }} />

      <Card className="w-full items-center gap-3">
        <View
          style={{ opacity: faded ? 0.3 : 1 }}
          className="rounded-xl bg-white p-4"
        >
          <QRCode value={ticket.token} size={qrSize} />
        </View>
        <Text className="text-muted-foreground text-xs uppercase">
          {ticket.status}
        </Text>
        {seatLabel ? (
          <Text className="text-foreground text-xl font-bold">{seatLabel}</Text>
        ) : null}
        {ticket.status === "used" && ticket.usedAt ? (
          <Text className="text-destructive text-sm">
            Checked in · {new Date(ticket.usedAt).toLocaleString()}
          </Text>
        ) : null}
      </Card>

      <Card className="w-full gap-2">
        <Text className="text-foreground font-semibold">Holder name</Text>
        {editing ? (
          <>
            <Field
              label=""
              value={draft}
              onChangeText={setDraft}
              placeholder="Defaults to your name"
            />
            {error ? (
              <Text className="text-destructive text-sm">{error}</Text>
            ) : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Save"
                  loading={updateHolder.isPending}
                  onPress={() =>
                    updateHolder.mutate({
                      ticketId: ticket.id,
                      holderName: draft.trim() || undefined,
                    })
                  }
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => setDraft(null)}
                />
              </View>
            </View>
          </>
        ) : (
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground">
              {ticket.holderName ?? "Not set"}
            </Text>
            {ticket.status === "active" ? (
              <Button
                label="Edit"
                variant="outline"
                onPress={() => setDraft(ticket.holderName ?? "")}
              />
            ) : null}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}
