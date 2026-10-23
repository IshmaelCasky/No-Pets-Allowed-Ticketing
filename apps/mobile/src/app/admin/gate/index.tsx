import { useState } from "react";
import { View } from "react-native";

import { RequirePerm, Segmented } from "~/components/admin";
import { CheckinsView } from "~/components/ops/gate/checkins-view";
import { ConcertChooser } from "~/components/ops/gate/concert";
import { ScanLogView } from "~/components/ops/gate/scan-log-view";
import { ScannerView } from "~/components/ops/gate/scanner-view";
import { useScanConcerts } from "~/components/ops/hooks";

type Mode = "scan" | "checkins" | "log";

const MODES: { value: Mode; label: string }[] = [
  { value: "scan", label: "Scanner" },
  { value: "checkins", label: "Check-ins" },
  { value: "log", label: "Scan log" },
];

/**
 * Gate tab (`tickets:scan`): Scanner | Check-ins | Scan log in one screen so
 * switching is instant at the door. The picked concert is shared by the
 * Scanner and Check-ins (and seeds the Scan log filter).
 */
function Gate() {
  const [mode, setMode] = useState<Mode>("scan");
  const [picked, setPicked] = useState<string | undefined>();
  const concerts = useScanConcerts();
  const only = concerts.data?.length === 1 ? concerts.data[0]?.id : undefined;
  const eventId = picked ?? only;

  return (
    <View className="flex-1">
      <View className="border-border bg-background border-b px-4 py-2">
        <Segmented options={MODES} value={mode} onChange={setMode} />
      </View>
      {mode === "log" ? (
        <ScanLogView initialEventId={eventId} />
      ) : !eventId ? (
        <ConcertChooser
          prompt={
            mode === "scan"
              ? "Which concert are you scanning?"
              : "Check-ins for which concert?"
          }
          onPick={setPicked}
        />
      ) : mode === "scan" ? (
        <ScannerView eventId={eventId} onChangeConcert={setPicked} />
      ) : (
        <CheckinsView eventId={eventId} onChangeConcert={setPicked} />
      )}
    </View>
  );
}

export default function GateScreen() {
  return (
    <RequirePerm anyOf={["tickets:scan"]}>
      <Gate />
    </RequirePerm>
  );
}
