/**
 * Bottom-sheet text prompt (Alert.prompt is iOS-only). Used for the refund
 * rejection reason. Validation is the caller's job via `validate`, so the
 * shared Zod schema stays the source of truth.
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/ui";

export function ReasonSheet({
  visible,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  destructive,
  loading,
  validate,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  submitLabel: string;
  destructive?: boolean;
  loading?: boolean;
  /** Return an error message to block submit, or null when valid. */
  validate: (text: string) => string | null;
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setText("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <Pressable className="flex-1 bg-black/40" onPress={close} />
        <View
          className="bg-background gap-3 rounded-t-2xl p-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Text className="text-foreground text-lg font-bold">{title}</Text>
          {description ? (
            <Text className="text-muted-foreground text-sm">{description}</Text>
          ) : null}
          <Text className="text-foreground text-sm font-medium">{label}</Text>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            multiline
            autoFocus
            textAlignVertical="top"
            className="border-border bg-input text-foreground min-h-24 rounded-lg border px-3 py-3 text-base"
          />
          {error ? (
            <Text className="text-destructive text-xs">{error}</Text>
          ) : null}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Back"
                variant="outline"
                disabled={loading}
                onPress={close}
              />
            </View>
            <View className="flex-1">
              <Button
                label={submitLabel}
                variant={destructive ? "destructive" : "primary"}
                loading={loading}
                onPress={() => {
                  const err = validate(text);
                  if (err) {
                    setError(err);
                    return;
                  }
                  onSubmit(text.trim());
                }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
