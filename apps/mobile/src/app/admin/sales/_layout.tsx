import { Stack } from "expo-router";

/** Transactions stack — header styled like the rest of the app. */
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Transactions" }} />
      <Stack.Screen name="order/[code]" options={{ title: "Order" }} />
      <Stack.Screen name="refund/[id]" options={{ title: "Refund request" }} />
    </Stack>
  );
}
