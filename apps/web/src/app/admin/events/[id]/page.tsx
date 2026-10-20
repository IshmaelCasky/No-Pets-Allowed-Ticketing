import { notFound } from "next/navigation";

import { getAdminCaller } from "../../_lib/caller";
import { EventDetailClient } from "./_components/event-detail-client";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caller = await getAdminCaller();
  const event = await caller.event.byId({ id });
  if (!event) notFound();

  return <EventDetailClient eventId={id} />;
}
