import { Alert } from "react-native";

/** Pull a human message out of a tRPC / unknown error. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

/** Show an error (tRPC codes like CONFLICT / FORBIDDEN carry a message). */
export function showError(err: unknown, title = "Couldn't complete that") {
  Alert.alert(title, errorMessage(err));
}

/** Native confirm dialog. Destructive actions get a red button on iOS. */
export function confirm(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  Alert.alert(opts.title, opts.message, [
    { text: "Cancel", style: "cancel" },
    {
      text: opts.confirmLabel ?? "Confirm",
      style: opts.destructive ? "destructive" : "default",
      onPress: opts.onConfirm,
    },
  ]);
}
