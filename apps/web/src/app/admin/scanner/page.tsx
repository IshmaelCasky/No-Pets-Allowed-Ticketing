import { PageHeader } from "~/app/admin/_components/page-header";
import { ScannerClient } from "./_components/scanner-client";

export default function ScannerPage() {
  return (
    <div>
      <PageHeader
        title="QR Scanner"
        description="Scan tickets at the gate. Pick a concert, then scan or enter a code."
      />
      <ScannerClient />
    </div>
  );
}
