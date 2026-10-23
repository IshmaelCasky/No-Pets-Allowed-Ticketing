import { Stack } from "expo-router";

export default function EventsStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Concerts" }} />
      <Stack.Screen name="[slug]" options={{ title: "Concert" }} />
      <Stack.Screen name="checkout/[slug]" options={{ title: "Checkout" }} />
      <Stack.Screen name="pay/[code]" options={{ title: "Pay" }} />
    </Stack>
  );
}
