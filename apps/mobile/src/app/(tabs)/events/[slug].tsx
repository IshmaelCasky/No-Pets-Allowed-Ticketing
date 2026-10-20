import { Image, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Button, Card, Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { formatCentavos, formatManila } from "~/utils/format";

export default function EventDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  const eventQ = useQuery(trpc.event.bySlug.queryOptions({ slug }));
  const event = eventQ.data;

  const tiersQ = useQuery({
    ...trpc.event.tiersByEvent.queryOptions({ eventId: event?.id ?? "" }),
    enabled: !!event && event.seatingMode === "ga",
  });
  const mapQ = useQuery({
    ...trpc.seatMap.forEvent.queryOptions({ eventId: event?.id ?? "" }),
    enabled: !!event && event.seatingMode === "reserved",
  });

  if (eventQ.isLoading) return <Loading label="Loading show…" />;
  if (!event) return <Empty title="Show not found" />;

  return (
    <ScrollView contentContainerClassName="p-4 gap-4 pb-28">
      <Stack.Screen options={{ title: event.title }} />

      {event.posterUrl ? (
        <Image
          source={{ uri: event.posterUrl }}
          className="h-60 w-full rounded-xl"
          resizeMode="cover"
        />
      ) : null}

      <View className="gap-1">
        <Text className="text-foreground text-2xl font-bold">
          {event.title}
        </Text>
        {event.lineup ? (
          <Text className="text-primary font-semibold">{event.lineup}</Text>
        ) : null}
        <Text className="text-muted-foreground">{event.venue}</Text>
        <Text className="text-foreground">{formatManila(event.startsAt)}</Text>
        {event.doorsOpenAt ? (
          <Text className="text-muted-foreground text-sm">
            Doors open {formatManila(event.doorsOpenAt)}
          </Text>
        ) : null}
      </View>

      {event.description ? (
        <Text className="text-foreground leading-6">{event.description}</Text>
      ) : null}

      {event.seatingMode === "ga" ? (
        <View className="gap-2">
          <Text className="text-foreground text-lg font-bold">
            Ticket tiers
          </Text>
          {tiersQ.data?.map((t) => {
            const remaining = t.capacity - t.reserved - t.sold;
            return (
              <Card key={t.id} className="flex-row justify-between">
                <View>
                  <Text className="text-foreground font-semibold">
                    {t.name}
                  </Text>
                  <Text className="text-muted-foreground text-sm">
                    {remaining > 0 ? `${remaining} left` : "Sold out"}
                  </Text>
                </View>
                <Text className="text-primary font-bold">
                  {formatCentavos(t.price)}
                </Text>
              </Card>
            );
          })}
        </View>
      ) : (
        <View className="gap-2">
          <Text className="text-foreground text-lg font-bold">Sections</Text>
          {mapQ.data?.sections.map((s) => (
            <Card key={s.id} className="flex-row justify-between">
              <Text className="text-foreground font-semibold">{s.name}</Text>
              <Text className="text-primary font-bold">
                {formatCentavos(s.price)}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Card className="gap-1">
        <Text className="text-foreground font-semibold">How to buy</Text>
        <Text className="text-muted-foreground text-sm">
          Reserve your {event.seatingMode === "ga" ? "tickets" : "seats"}, pay
          via the posted QR within the 30-minute window, upload your receipt,
          and get your QR ticket once staff approve it. Refunds can be requested
          up to {event.refundCutoffDays} days before the show.
        </Text>
      </Card>

      <Button
        label="Buy tickets"
        onPress={() => router.push(`/(tabs)/events/checkout/${event.slug}`)}
      />
    </ScrollView>
  );
}
