import { FlatList, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { Card, Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { formatManila } from "~/utils/format";

type Event = RouterOutputs["event"]["publicList"][number];

function EventCard({ event }: { event: Event }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/(tabs)/events/${event.slug}`)}>
      <Card className="gap-2 overflow-hidden p-0">
        {event.posterUrl ? (
          <Image
            source={{ uri: event.posterUrl }}
            className="h-44 w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="bg-secondary h-44 w-full items-center justify-center">
            <Text className="text-muted-foreground text-4xl font-bold">
              NPA
            </Text>
          </View>
        )}
        <View className="gap-1 p-4">
          <Text className="text-foreground text-lg font-bold">
            {event.title}
          </Text>
          {event.venue ? (
            <Text className="text-muted-foreground">{event.venue}</Text>
          ) : null}
          <Text className="text-primary text-sm font-semibold">
            {formatManila(event.startsAt)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function EventsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery(
    trpc.event.publicList.queryOptions(),
  );

  if (isLoading) return <Loading label="Loading concerts…" />;
  if (!data || data.length === 0) {
    return (
      <Empty
        title="No upcoming concerts"
        hint="Check back soon for new No Pets Allowed concerts."
      />
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(e) => e.id}
      contentContainerClassName="p-4 gap-4"
      renderItem={({ item }) => <EventCard event={item} />}
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
    />
  );
}
