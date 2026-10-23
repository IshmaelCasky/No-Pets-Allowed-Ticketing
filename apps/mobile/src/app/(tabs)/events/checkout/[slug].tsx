import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { GaCheckout } from "./_ga-checkout";

export default function Checkout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const eventQ = useQuery(trpc.event.bySlug.queryOptions({ slug }));
  const event = eventQ.data;

  if (eventQ.isLoading) return <Loading />;
  if (!event) return <Empty title="Concert not found" />;

  return (
    <>
      <Stack.Screen options={{ title: `Checkout · ${event.title}` }} />
      <GaCheckout event={event} />
    </>
  );
}
