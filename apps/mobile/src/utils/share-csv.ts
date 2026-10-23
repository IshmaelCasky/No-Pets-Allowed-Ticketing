import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Delete earlier CSV exports from the cache folder. Exports contain customer
 * names/emails, so they must not pile up on staff phones. Called before each
 * new export (not right after sharing — on Android the receiving app may still
 * be reading the file) and on sign-out.
 */
export function clearCsvExports(): void {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File && entry.name.endsWith(".csv")) {
        entry.delete();
      }
    }
  } catch {
    // Best effort — a missing/locked file shouldn't block the export.
  }
}

/**
 * Save a CSV string to the cache folder and open the share sheet, so staff can
 * send exports (attendees, scan log, audit log) to email, Drive, Files, etc.
 */
export async function shareCsv(filename: string, csv: string): Promise<void> {
  clearCsvExports();
  const safe = filename.replace(/[^a-z0-9._-]+/gi, "-");
  const file = new File(
    Paths.cache,
    safe.endsWith(".csv") ? safe : `${safe}.csv`,
  );
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle: safe,
  });
}
