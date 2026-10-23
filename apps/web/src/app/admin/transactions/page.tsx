import { PageHeader } from "~/app/admin/_components/page-header";
import { TransactionsClient } from "./_components/transactions-client";

export default function TransactionsPage() {
  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Manage orders and process refunds."
      />
      <TransactionsClient />
    </div>
  );
}
