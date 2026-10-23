/**
 * Modal pickers for the ops modules: a tappable field that opens a bottom
 * sheet of options (concert, staff member…). Long lists scroll; an optional
 * "All" row clears the filter.
 */
import type { ReactNode } from "react";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string | null;
  right?: ReactNode;
}

export function SelectSheet({
  visible,
  title,
  options,
  value,
  allLabel,
  emptyLabel = "Nothing to choose from yet.",
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly SelectOption[];
  value: string | undefined;
  /** Leading row that selects `undefined` (clears the filter). */
  allLabel?: string;
  emptyLabel?: string;
  onSelect: (value: string | undefined) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const rows: (SelectOption & { all?: boolean })[] = allLabel
    ? [{ value: "__all", label: allLabel, all: true }, ...options]
    : [...options];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View
        className="bg-background max-h-[70%] rounded-t-2xl"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <View className="border-border flex-row items-center justify-between border-b px-4 py-3">
          <Text className="text-foreground text-base font-bold">{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text className="text-primary text-base font-semibold">Close</Text>
          </Pressable>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(o) => o.value}
          contentContainerClassName="p-2"
          ListEmptyComponent={
            <Text className="text-muted-foreground p-6 text-center">
              {emptyLabel}
            </Text>
          }
          renderItem={({ item }) => {
            const active = item.all
              ? value === undefined
              : value === item.value;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.all ? undefined : item.value);
                  onClose();
                }}
                className={`flex-row items-center gap-3 rounded-lg px-3 py-3 active:opacity-70 ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                <View className="flex-1">
                  <Text
                    className={`text-base ${
                      active ? "text-primary font-bold" : "text-foreground"
                    }`}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {item.hint ? (
                    <Text
                      className="text-muted-foreground text-xs"
                      numberOfLines={1}
                    >
                      {item.hint}
                    </Text>
                  ) : null}
                </View>
                {item.right}
                {active ? (
                  <Text className="text-primary text-base font-bold">✓</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

/** Field-looking trigger that opens a {@link SelectSheet}. */
export function SelectField({
  label,
  title,
  options,
  value,
  placeholder,
  allLabel,
  emptyLabel,
  onChange,
}: {
  label?: string;
  /** Sheet title (defaults to `label`). */
  title?: string;
  options: readonly SelectOption[];
  value: string | undefined;
  placeholder: string;
  allLabel?: string;
  emptyLabel?: string;
  onChange: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View className="flex-1 gap-1">
      {label ? (
        <Text className="text-muted-foreground text-xs font-medium">
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        className="border-border bg-input flex-row items-center gap-2 rounded-lg border px-3 py-2.5 active:opacity-70"
      >
        <Text
          className={`flex-1 text-base ${
            current ? "text-foreground" : "text-muted-foreground"
          }`}
          numberOfLines={1}
        >
          {current?.label ??
            (value === undefined && allLabel ? allLabel : placeholder)}
        </Text>
        <Text className="text-muted-foreground">▾</Text>
      </Pressable>
      <SelectSheet
        visible={open}
        title={title ?? label ?? placeholder}
        options={options}
        value={value}
        allLabel={allLabel}
        emptyLabel={emptyLabel}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
