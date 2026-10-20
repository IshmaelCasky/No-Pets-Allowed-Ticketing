import { PageHeader } from "~/app/admin/_components/page-header";
import { AuditClient } from "./_components/audit-client";

export default function AuditLogsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit Logs"
        description="Append-only record of every admin mutation."
      />
      <AuditClient />
    </div>
  );
}
