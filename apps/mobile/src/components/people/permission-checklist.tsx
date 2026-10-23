import { Pressable, Text, View } from "react-native";

import type { PermissionKey } from "@npa/validators";

import { ToggleRow } from "./controls";
import { PERMISSION_GROUPS, permissionActionLabel } from "./labels";

/**
 * Permission toggles grouped by resource (same grouping as the web). Each
 * group has an "All" shortcut. `disabled` = read-only (system roles).
 */
export function PermissionChecklist({
  value,
  onChange,
  disabled,
}: {
  value: readonly PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);

  const set = (keys: readonly PermissionKey[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange([...next]);
  };

  return (
    <View className="gap-3">
      {PERMISSION_GROUPS.map((group) => {
        const all = group.keys.every((k) => selected.has(k));
        const count = group.keys.filter((k) => selected.has(k)).length;
        return (
          <View
            key={group.resource}
            className="border-border bg-card overflow-hidden rounded-xl border"
          >
            <View className="bg-muted flex-row items-center justify-between px-4 py-2">
              <Text className="text-foreground text-sm font-bold">
                {group.label}
                <Text className="text-muted-foreground font-normal">
                  {"  "}
                  {count}/{group.keys.length}
                </Text>
              </Text>
              {disabled ? null : (
                <Pressable hitSlop={8} onPress={() => set(group.keys, !all)}>
                  <Text className="text-primary text-sm font-semibold">
                    {all ? "None" : "All"}
                  </Text>
                </Pressable>
              )}
            </View>
            {group.keys.map((key, i) => (
              <ToggleRow
                key={key}
                label={permissionActionLabel(key)}
                hint={key}
                value={selected.has(key)}
                onChange={(on) => set([key], on)}
                disabled={disabled}
                bordered={i > 0}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}
