"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@npa/ui/tabs";

import type { ScanEventOption } from "../_lib/types";
import { useListParams } from "~/app/admin/_lib/use-list-params";
import { CheckinsTab } from "./checkins-tab";
import { ScanLogTab } from "./scan-log-tab";

const TABS = ["checkins", "log"] as const;
type TabKey = (typeof TABS)[number];

export function ScansClient({
  events,
  defaultEventId,
}: {
  events: ScanEventOption[];
  defaultEventId: string | undefined;
}) {
  const { get, setParams } = useListParams();
  const current = get("tab");
  const tab: TabKey = TABS.includes(current as TabKey)
    ? (current as TabKey)
    : "checkins";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setParams({ tab: value, page: undefined })}
    >
      <TabsList>
        <TabsTrigger value="checkins">Check-ins</TabsTrigger>
        <TabsTrigger value="log">Scan log</TabsTrigger>
      </TabsList>

      <TabsContent value="checkins" className="mt-4">
        {tab === "checkins" && (
          <CheckinsTab events={events} defaultEventId={defaultEventId} />
        )}
      </TabsContent>
      <TabsContent value="log" className="mt-4">
        {tab === "log" && <ScanLogTab events={events} />}
      </TabsContent>
    </Tabs>
  );
}
