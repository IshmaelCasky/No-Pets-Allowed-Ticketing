"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@npa/ui/tabs";

import { useListParams } from "~/app/admin/_lib/use-list-params";
import { OrdersTab } from "./orders-tab";
import { RefundsTab } from "./refunds-tab";

const TABS = ["orders", "refunds"] as const;
type TabKey = (typeof TABS)[number];

export function TransactionsClient() {
  const { get, setParams } = useListParams();
  const current = get("tab");
  const tab: TabKey = TABS.includes(current as TabKey)
    ? (current as TabKey)
    : "orders";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setParams({ tab: value, page: undefined })}
    >
      <TabsList>
        <TabsTrigger value="orders">Orders</TabsTrigger>
        <TabsTrigger value="refunds">Refunds</TabsTrigger>
      </TabsList>

      <TabsContent value="orders" className="mt-6">
        {tab === "orders" && <OrdersTab />}
      </TabsContent>
      <TabsContent value="refunds" className="mt-6">
        {tab === "refunds" && <RefundsTab />}
      </TabsContent>
    </Tabs>
  );
}
