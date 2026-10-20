import { PageHeader } from "../_components/page-header";
import { EventsClient } from "./_components/events-client";

export default function EventsPage() {
  return (
    <div>
      <PageHeader
        title="Events"
        description="Create and manage concerts, ticket tiers, and seat maps"
      />
      <EventsClient />
    </div>
  );
}
