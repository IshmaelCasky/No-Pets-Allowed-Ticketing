import { PageHeader } from "~/app/admin/_components/page-header";
import { getAdminCaller } from "~/app/admin/_lib/caller";
import { ScansClient } from "./_components/scans-client";
import { pickDefaultEventId } from "./_lib/types";

export default async function ScansPage() {
  const caller = await getAdminCaller();
  const me = await caller.auth.me();

  if (!me.permissions.includes("tickets:scan")) {
    return (
      <div>
        <PageHeader title="Scans" />
        <p className="text-muted-foreground text-sm">
          You need the <span className="font-mono">tickets:scan</span>{" "}
          permission to view check-ins and scan logs.
        </p>
      </div>
    );
  }

  const events = await caller.scan.eventOptions();
  const defaultEventId = pickDefaultEventId(events);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Scans"
        description="Who has arrived, and every scan attempt at the gate."
      />
      <ScansClient events={events} defaultEventId={defaultEventId} />
    </div>
  );
}
