/**
 * Shared building blocks for the staff/admin section of the app
 * (`src/app/admin/**`). Keep screens consistent by using these instead of
 * one-off styles. Generic primitives (Button, Field, Card, Loading, Empty)
 * live in `./ui`.
 */
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import type { PermissionKey } from "@npa/validators";

import { usePermissions } from "~/utils/use-permissions";
import { Empty, Loading } from "./ui";

/* ------------------------------- Pill ---------------------------------- */
export type Tone = "green" | "red" | "amber" | "blue" | "gray" | "purple";

const TONE: Record<Tone, string> = {
  green: "bg-green-500/20 text-green-600",
  red: "bg-red-500/20 text-red-600",
  amber: "bg-amber-500/20 text-amber-600",
  blue: "bg-blue-500/20 text-blue-600",
  gray: "bg-gray-500/20 text-gray-500",
  purple: "bg-purple-500/20 text-purple-600",
};

/** Small coloured status label. Map statuses → tones in the screen. */
export function Pill({ label, tone = "gray" }: { label: string; tone?: Tone }) {
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${TONE[tone]}`}>
      <Text className={`text-xs font-semibold ${TONE[tone]}`}>{label}</Text>
    </View>
  );
}

/* ----------------------------- SearchBar ------------------------------- */
export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search…",
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      returnKeyType="search"
      className="border-border bg-input text-foreground rounded-lg border px-3 py-2.5 text-base"
    />
  );
}

/* ------------------------------- Chips --------------------------------- */
/** Horizontal single-select filter. `value` undefined = the "All" chip. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  allLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  /** Show a leading "All" chip that clears the filter. */
  allLabel?: string;
}) {
  const chip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        active ? "border-primary bg-primary" : "border-border bg-card"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          active ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2"
    >
      {allLabel
        ? chip("__all", allLabel, value === undefined, () =>
            onChange(undefined),
          )
        : null}
      {options.map((o) =>
        chip(o.value, o.label, value === o.value, () => onChange(o.value)),
      )}
    </ScrollView>
  );
}

/* ----------------------------- Segmented ------------------------------- */
/** Tab-style switcher inside a screen (e.g. Orders | Refunds). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="bg-muted flex-row rounded-lg p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`flex-1 rounded-md py-2 ${active ? "bg-card" : ""}`}
          >
            <Text
              className={`text-center text-sm font-semibold ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ----------------------------- KeyValue -------------------------------- */
export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-1">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text className="text-foreground flex-1 text-right text-sm font-medium">
          {value}
        </Text>
      ) : (
        <View className="flex-1 items-end">{value}</View>
      )}
    </View>
  );
}

/* --------------------------- SectionHeader ----------------------------- */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <Text className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
        {title}
      </Text>
      {action}
    </View>
  );
}

/* ------------------------------- Stat ---------------------------------- */
/** Dashboard tile. Put two per row with `className="flex-1"`. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <View
      className={`border-border bg-card gap-1 rounded-xl border p-4 ${className ?? ""}`}
    >
      <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
      <Text className="text-foreground text-2xl font-bold">{value}</Text>
      {hint ? (
        <Text className="text-muted-foreground text-xs">{hint}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------ ListRow -------------------------------- */
/** Tappable list item: title, optional subtitle lines, right-side slot. */
export function ListRow({
  title,
  subtitle,
  meta,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="border-border bg-card flex-row items-center gap-3 rounded-xl border p-3 active:opacity-70"
    >
      <View className="flex-1 gap-0.5">
        <Text
          className="text-foreground text-base font-semibold"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? (
        <Text className="text-muted-foreground text-lg">›</Text>
      ) : null}
    </Pressable>
  );
}

/* ---------------------------- ListFooter ------------------------------- */
/** FlatList footer: spinner while loading the next page, else a count. */
export function ListFooter({
  loading,
  shown,
  total,
}: {
  loading: boolean;
  shown: number;
  total: number;
}) {
  if (loading) {
    return (
      <View className="py-4">
        <ActivityIndicator color="#c03484" />
      </View>
    );
  }
  if (total === 0) return null;
  return (
    <Text className="text-muted-foreground py-4 text-center text-xs">
      Showing {shown} of {total}
    </Text>
  );
}

/* ----------------------------- RequirePerm ----------------------------- */
/**
 * Guards a screen by permission KEY (any one of `anyOf`). The API enforces the
 * same keys; this just avoids showing a screen that would only error.
 */
export function RequirePerm({
  anyOf,
  children,
}: {
  anyOf: readonly PermissionKey[];
  children: ReactNode;
}) {
  const { hasAny, isLoading } = usePermissions();
  if (isLoading) return <Loading />;
  if (!hasAny(anyOf)) {
    return (
      <Empty
        title="No access"
        hint="Your role doesn't include this module. Ask a Super Admin."
      />
    );
  }
  return <>{children}</>;
}
