import { useState } from "react";
import { View } from "react-native";

import { RequirePerm, Segmented } from "~/components/admin";
import { OrdersList } from "~/components/ops/sales/orders-list";
import { RefundsList } from "~/components/ops/sales/refunds-list";
import { usePermissions } from "~/utils/use-permissions";

type Tab = "orders" | "refunds";

/** Transactions: Orders | Refunds. A segment shows only with its key. */
function Transactions() {
  const { has } = usePermissions();
  const tabs = [
    ...(has("orders:read")
      ? [{ value: "orders" as const, label: "Orders" }]
      : []),
    ...(has("refunds:review")
      ? [{ value: "refunds" as const, label: "Refunds" }]
      : []),
  ];
  const [picked, setPicked] = useState<Tab | undefined>();
  const tab = tabs.find((t) => t.value === picked)?.value ?? tabs[0]?.value;

  return (
    <View className="flex-1 pt-3">
      {tabs.length > 1 ? (
        <View className="px-4 pb-3">
          <Segmented
            options={tabs}
            value={tab ?? "orders"}
            onChange={setPicked}
          />
        </View>
      ) : null}
      {tab === "orders" ? <OrdersList /> : null}
      {tab === "refunds" ? <RefundsList /> : null}
    </View>
  );
}

export default function TransactionsScreen() {
  return (
    <RequirePerm anyOf={["orders:read", "refunds:review"]}>
      <Transactions />
    </RequirePerm>
  );
}
