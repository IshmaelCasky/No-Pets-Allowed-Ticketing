import type { ReactNode } from "react";
import type { TextInputProps } from "react-native";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import type { OrderStatus } from "@npa/validators";

import { orderStatusLabel } from "~/utils/format";

/* ------------------------------- Button -------------------------------- */
export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "destructive" | "outline";
}) {
  const bg =
    variant === "primary"
      ? "bg-primary"
      : variant === "destructive"
        ? "bg-destructive"
        : variant === "secondary"
          ? "bg-secondary"
          : "bg-transparent border border-border";
  const fg =
    variant === "outline" || variant === "secondary"
      ? "text-foreground"
      : "text-primary-foreground";
  const isDisabled = disabled ?? loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${bg} flex-row items-center justify-center rounded-lg px-4 py-3 ${
        isDisabled ? "opacity-50" : ""
      }`}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={`${fg} text-center text-base font-semibold`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/* -------------------------------- Input -------------------------------- */
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View className="gap-1">
      <Text className="text-foreground text-sm font-medium">{label}</Text>
      <TextInput
        placeholderTextColor="#9ca3af"
        className="border-border bg-input text-foreground rounded-lg border px-3 py-3 text-base"
        {...props}
      />
      {error ? <Text className="text-destructive text-xs">{error}</Text> : null}
    </View>
  );
}

/* -------------------------------- Card --------------------------------- */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`border-border bg-card rounded-xl border p-4 ${className ?? ""}`}
    >
      {children}
    </View>
  );
}

/* ------------------------------ StatusBadge ---------------------------- */
const ORDER_TONE: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-500/20 text-amber-600",
  for_review: "bg-blue-500/20 text-blue-600",
  approved: "bg-green-500/20 text-green-600",
  rejected: "bg-red-500/20 text-red-600",
  expired: "bg-gray-500/20 text-gray-500",
  cancelled: "bg-gray-500/20 text-gray-500",
  refunded: "bg-purple-500/20 text-purple-600",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = ORDER_TONE[status];
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${tone}`}>
      <Text className={`text-xs font-semibold ${tone}`}>
        {orderStatusLabel(status)}
      </Text>
    </View>
  );
}

/* ------------------------------- Loading ------------------------------- */
export function Loading({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 p-8">
      <ActivityIndicator color="#c03484" size="large" />
      {label ? <Text className="text-muted-foreground">{label}</Text> : null}
    </View>
  );
}

/* ------------------------------- Empty --------------------------------- */
export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-1 p-8">
      <Text className="text-foreground text-center text-lg font-semibold">
        {title}
      </Text>
      {hint ? (
        <Text className="text-muted-foreground text-center">{hint}</Text>
      ) : null}
    </View>
  );
}
