import { FlatList, RefreshControl, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { ListRow, RequirePerm, SectionHeader, Stat } from "~/components/admin";
import { Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { errorMessage } from "~/utils/feedback";
import { formatCentavos } from "~/utils/format";

/** Dashboard — same numbers as the web dashboard (`dashboard.summary`). */
function Dashboard() {
  const summary = useQuery(trpc.dashboard.summary.queryOptions());

  if (summary.isLoading) return <Loading />;
  if (!summary.data) {
    return (
      <Empty
        title="Couldn't load the dashboard"
        hint={summary.error ? errorMessage(summary.error) : undefined}
      />
    );
  }

  const data = summary.data;
  const totalSold = data.ticketsSoldByEvent.reduce(
    (s, e) => s + e.ticketsSold,
    0,
  );
  const perConcert = [...data.ticketsSoldByEvent].sort(
    (a, b) => b.ticketsSold - a.ticketsSold,
  );

  return (
    <FlatList
      data={perConcert}
      keyExtractor={(e) => e.eventId}
      contentContainerClassName="gap-2 p-4"
      refreshControl={
        <RefreshControl
          refreshing={summary.isRefetching}
          onRefresh={() => void summary.refetch()}
          tintColor="#c03484"
        />
      }
      ListHeaderComponent={
        <View className="gap-3 pb-1">
          <View className="flex-row gap-3">
            <Stat
              className="flex-1"
              label="Pending payment"
              value={data.pendingPaymentCount}
              hint="Unpaid orders holding inventory"
            />
            <Stat
              className="flex-1"
              label="Approved revenue"
              value={formatCentavos(data.approvedRevenue)}
            />
          </View>
          <View className="flex-row gap-3">
            <Stat
              className="flex-1"
              label="Check-ins today"
              value={data.checkInsToday}
            />
            <Stat
              className="flex-1"
              label="Tickets sold"
              value={totalSold}
              hint="All concerts"
            />
          </View>
          <SectionHeader title="Tickets sold per concert" />
        </View>
      }
      ListEmptyComponent={
        <Text className="text-muted-foreground py-6 text-center">
          No concerts yet.
        </Text>
      }
      renderItem={({ item }) => (
        <ListRow
          title={item.eventTitle}
          right={
            <Text className="text-foreground text-lg font-bold">
              {item.ticketsSold}
            </Text>
          }
        />
      )}
    />
  );
}

export default function DashboardScreen() {
  return (
    <RequirePerm anyOf={["orders:read"]}>
      <Dashboard />
    </RequirePerm>
  );
}
