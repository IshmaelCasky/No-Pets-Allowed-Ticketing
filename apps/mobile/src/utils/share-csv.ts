import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Save a CSV string to the cache folder and open the share sheet, so staff can
 * send exports (attendees, scan log, audit log) to email, Drive, Files, etc.
 */
export async function shareCsv(filename: string, csv: string): Promise<void> {
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
