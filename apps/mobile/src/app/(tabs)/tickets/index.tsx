import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { Card, Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";

type Ticket = RouterOutputs["ticket"]["myTickets"][number];

const GROUPS: { key: Ticket["status"]; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "used", label: "Used" },
  { key: "void", label: "Void" },
];

function TicketRow({
  ticket,
  eventTitle,
}: {
  ticket: Ticket;
  eventTitle: string;
}) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/(tabs)/tickets/${ticket.id}`)}>
      <Card className="flex-row items-center justify-between">
        <View className="flex-1 gap-0.5">
          <Text className="text-foreground font-semibold" numberOfLines={1}>
            {eventTitle}
          </Text>
          {ticket.holderName ? (
            <Text className="text-muted-foreground text-sm">
              {ticket.holderName}
            </Text>
          ) : null}
        </View>
        <Text className="text-primary text-2xl">›</Text>
      </Card>
    </Pressable>
  );
}

export default function TicketsScreen() {
  const ticketsQ = useQuery({
    ...trpc.ticket.myTickets.queryOptions(),
    // Persisted cache rehydrates these offline; refetch on reconnect.
    networkMode: "offlineFirst",
  });
  const eventsQ = useQuery(trpc.event.publicList.queryOptions());

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of eventsQ.data ?? []) m.set(e.id, e.title);
    return m;
  }, [eventsQ.data]);

  if (ticketsQ.isLoading) return <Loading label="Loading tickets…" />;
  if (!ticketsQ.data || ticketsQ.data.length === 0) {
    return (
      <Empty
        title="No tickets yet"
        hint="Buy tickets from the Events tab to see them here."
      />
    );
  }

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: ticketsQ.data.filter((t) => t.status === g.key),
  })).filter((g) => g.items.length > 0);

  return (
    <ScrollView
      contentContainerClassName="p-4 gap-4 pb-8"
      refreshControl={undefined}
    >
      <Link
        href="/(tabs)/tickets/orders"
        className="text-primary font-semibold"
      >
        View my orders →
      </Link>
      {grouped.map((g) => (
        <View key={g.key} className="gap-2">
          <Text className="text-muted-foreground text-xs font-semibold uppercase">
            {g.label}
          </Text>
          {g.items.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              eventTitle={titleById.get(t.eventId) ?? "Event"}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
