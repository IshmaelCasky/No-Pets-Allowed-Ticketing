import { useState } from "react";

import { showError } from "~/utils/feedback";
import { shareCsv } from "~/utils/share-csv";

/** Fetch a CSV from the API and open the share sheet; tracks the busy state. */
export function useCsvExport() {
  const [exporting, setExporting] = useState(false);
  const run = async (filename: string, fetchCsv: () => Promise<string>) => {
    setExporting(true);
    try {
      await shareCsv(filename, await fetchCsv());
    } catch (err) {
      showError(err, "Export failed");
    } finally {
      setExporting(false);
    }
  };
  return { exporting, run };
}
