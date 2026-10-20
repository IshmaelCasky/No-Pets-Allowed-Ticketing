import { Stack } from "expo-router";

export default function AccountStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Account" }} />
      <Stack.Screen name="refunds" options={{ title: "My Refunds" }} />
      <Stack.Screen
        name="refund/[code]"
        options={{ title: "Request Refund" }}
      />
    </Stack>
  );
}
