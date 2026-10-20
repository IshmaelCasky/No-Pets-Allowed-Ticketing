"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@npa/ui/tabs";

import { useListParams } from "~/app/admin/_lib/use-list-params";
import { OrdersTab } from "./orders-tab";
import { PaymentOptionsTab } from "./payment-options-tab";
import { PaymentReviewTab } from "./payment-review-tab";
import { RefundsTab } from "./refunds-tab";

const TABS = ["review", "orders", "refunds", "payments"] as const;
type TabKey = (typeof TABS)[number];

export function TransactionsClient() {
  const { get, setParams } = useListParams();
  const current = get("tab");
  const tab: TabKey = TABS.includes(current as TabKey)
    ? (current as TabKey)
    : "review";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setParams({ tab: value, page: undefined })}
    >
      <TabsList>
        <TabsTrigger value="review">Payment Review</TabsTrigger>
        <TabsTrigger value="orders">Orders</TabsTrigger>
        <TabsTrigger value="refunds">Refunds</TabsTrigger>
        <TabsTrigger value="payments">Payment Options</TabsTrigger>
      </TabsList>

      <TabsContent value="review" className="mt-6">
        {tab === "review" && <PaymentReviewTab />}
      </TabsContent>
      <TabsContent value="orders" className="mt-6">
        {tab === "orders" && <OrdersTab />}
      </TabsContent>
      <TabsContent value="refunds" className="mt-6">
        {tab === "refunds" && <RefundsTab />}
      </TabsContent>
      <TabsContent value="payments" className="mt-6">
        {tab === "payments" && <PaymentOptionsTab />}
      </TabsContent>
    </Tabs>
  );
}
