import type { ReactNode } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";

import { Field } from "~/components/ui";
import { authClient } from "~/utils/auth";
import { showError } from "~/utils/feedback";
import { useImageUploader } from "~/utils/uploadthing";

/** Scrollable form body that stays clear of the keyboard. */
export function FormScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-4 pb-16"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
}

/** Label + hint + error wrapper for non-text inputs. */
export function FieldShell({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-foreground text-sm font-medium">{label}</Text>
      {children}
      {hint ? (
        <Text className="text-muted-foreground text-xs">{hint}</Text>
      ) : null}
      {error ? <Text className="text-destructive text-xs">{error}</Text> : null}
    </View>
  );
}

/** `YYYY-MM-DD HH:mm` text input (Asia/Manila). */
export function DateTimeField({
  label,
  value,
  onChangeText,
  error,
  optional,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  optional?: boolean;
}) {
  return (
    <View className="gap-1">
      <Field
        label={`${label} (Manila time)${optional ? " · optional" : ""}`}
        value={value}
        onChangeText={onChangeText}
        placeholder="2026-12-31 19:30"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        error={error}
      />
      {!error ? (
        <Text className="text-muted-foreground text-xs">
          YYYY-MM-DD HH:mm, 24-hour
        </Text>
      ) : null}
    </View>
  );
}

/** Multi-line text field. */
export function TextAreaField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      error={error}
      multiline
      textAlignVertical="top"
      style={{ minHeight: 110 }}
    />
  );
}

/** Pick one of a few options. Large tap targets for one-handed use. */
export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View className={`flex-row gap-2 ${disabled ? "opacity-50" : ""}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            className={`flex-1 items-center rounded-lg border px-3 py-3 ${
              active ? "border-primary bg-primary" : "border-border bg-card"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                active ? "text-primary-foreground" : "text-foreground"
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

const SWATCHES = [
  "#6366f1",
  "#2f7de6",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#8b5cf6",
  "#64748b",
] as const;

/** Section colour: preset swatches + free hex input. */
export function ColorField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <FieldShell label="Colour" error={error}>
      <View className="flex-row flex-wrap gap-2">
        {SWATCHES.map((c) => {
          const active = c.toLowerCase() === value.trim().toLowerCase();
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityLabel={`Colour ${c}`}
              style={{ backgroundColor: c }}
              className={`h-9 w-9 rounded-full ${
                active ? "border-foreground border-4" : ""
              }`}
            />
          );
        })}
      </View>
      <View className="flex-row items-center gap-3">
        <View
          style={{
            backgroundColor: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
              ? value
              : "transparent",
          }}
          className="border-border h-10 w-10 rounded-lg border"
        />
        <View className="flex-1">
          <Field
            label="Hex"
            value={value}
            onChangeText={onChange}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="#6366f1"
          />
        </View>
      </View>
    </FieldShell>
  );
}

/**
 * Pick an image from the library and upload it to the public `eventPoster`
 * UploadThing route (same route the web uses for posters and ticket-type
 * artwork). Reports the hosted URL.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  onRemove,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Omit to hide the Remove button. */
  onRemove?: () => void;
  hint?: string;
}) {
  const { openImagePicker, isUploading } = useImageUploader("eventPoster", {
    headers: () => ({ Cookie: authClient.getCookie() }),
    onClientUploadComplete: (res) => {
      const url = res[0]?.ufsUrl;
      if (url) onChange(url);
    },
    onUploadError: (e) => showError(e, "Upload failed"),
  });

  const pick = () => {
    void openImagePicker({
      source: "library",
      onInsufficientPermissions: () =>
        Alert.alert(
          "Photos access needed",
          "Allow photo library access in Settings to upload an image.",
        ),
    });
  };

  return (
    <FieldShell label={label} hint={hint ?? "JPG, PNG or WEBP · max 4 MB"}>
      <View className="flex-row items-center gap-3">
        {value ? (
          <Image
            source={{ uri: value }}
            className="bg-muted h-20 w-20 rounded-lg"
            resizeMode="cover"
          />
        ) : (
          <View className="border-border bg-muted h-20 w-20 items-center justify-center rounded-lg border border-dashed">
            <Text className="text-muted-foreground text-xs">No image</Text>
          </View>
        )}
        <View className="flex-1 gap-2">
          <Pressable
            onPress={pick}
            disabled={isUploading}
            className={`border-border items-center rounded-lg border px-3 py-2.5 ${
              isUploading ? "opacity-50" : ""
            }`}
          >
            <Text className="text-foreground text-sm font-semibold">
              {isUploading ? "Uploading…" : value ? "Replace" : "Choose image"}
            </Text>
          </Pressable>
          {value && onRemove && !isUploading ? (
            <Pressable
              onPress={onRemove}
              className="items-center rounded-lg px-3 py-2"
            >
              <Text className="text-destructive text-sm font-semibold">
                Remove
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </FieldShell>
  );
}
