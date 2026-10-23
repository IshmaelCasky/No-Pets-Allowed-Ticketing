/**
 * Small controls used by the User / Role / Audit screens. Local to these
 * modules on purpose (shared primitives live in `~/components/admin` / `ui`).
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

/** Debounce a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** First Zod issue message, for one-line form errors. */
export function firstIssue(
  error: {
    issues: readonly { message: string; path: readonly PropertyKey[] }[];
  },
  labels?: Record<string, string>,
): string {
  const issue = error.issues[0];
  if (!issue) return "Please check the form";
  const key = issue.path[0];
  const label = typeof key === "string" ? labels?.[key] : undefined;
  return label ? `${label}: ${issue.message}` : issue.message;
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text className="text-destructive text-sm">{message}</Text>;
}

/** Single-select list with large tap targets (role pickers). */
export function OptionList<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string; hint?: string | null }[];
  value: T | undefined;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View className="border-border bg-card overflow-hidden rounded-xl border">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            className={`flex-row items-center gap-3 px-4 py-3 active:opacity-70 ${
              i > 0 ? "border-border border-t" : ""
            } ${disabled ? "opacity-50" : ""}`}
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                active ? "border-primary" : "border-border"
              }`}
            >
              {active ? (
                <View className="bg-primary h-2.5 w-2.5 rounded-full" />
              ) : null}
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-base">{o.label}</Text>
              {o.hint ? (
                <Text className="text-muted-foreground text-xs">{o.hint}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A labelled switch row. */
export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
  bordered,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  bordered?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(!value)}
      className={`flex-row items-center gap-3 px-4 py-2.5 ${
        bordered ? "border-border border-t" : ""
      }`}
    >
      <View className="flex-1">
        <Text
          className={`text-base ${disabled ? "text-muted-foreground" : "text-foreground"}`}
        >
          {label}
        </Text>
        {hint ? (
          <Text className="text-muted-foreground font-mono text-xs">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: "#c03484" }}
      />
    </Pressable>
  );
}

/** Card that expands to reveal a form (inline actions on detail screens). */
export function ActionPanel({
  title,
  subtitle,
  open,
  onToggle,
  destructive,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="border-border bg-card overflow-hidden rounded-xl border">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center gap-3 p-4 active:opacity-70"
      >
        <View className="flex-1 gap-0.5">
          <Text
            className={`text-base font-semibold ${
              destructive ? "text-destructive" : "text-foreground"
            }`}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-muted-foreground text-sm">{subtitle}</Text>
          ) : null}
        </View>
        <Text className="text-muted-foreground text-lg">
          {open ? "⌃" : "⌄"}
        </Text>
      </Pressable>
      {open ? (
        <View className="border-border gap-3 border-t p-4">{children}</View>
      ) : null}
    </View>
  );
}

/** Text button for headers (`headerRight`). */
export function HeaderAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={12} className="px-1">
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}
