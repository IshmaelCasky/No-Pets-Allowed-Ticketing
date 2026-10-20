import { Stack } from "expo-router";

export default function TicketsStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "My Tickets" }} />
      <Stack.Screen name="[id]" options={{ title: "Ticket" }} />
      <Stack.Screen name="orders" options={{ title: "My Orders" }} />
    </Stack>
  );
}
