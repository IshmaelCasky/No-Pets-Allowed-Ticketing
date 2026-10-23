import { Stack } from "expo-router";

/** Concerts stack — header styled like the rest of the app. */
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2f7de6" },
        headerTintColor: "#ffffff",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Concerts" }} />
      <Stack.Screen name="new" options={{ title: "New concert" }} />
      <Stack.Screen name="[id]/index" options={{ title: "Concert" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit concert" }} />
      <Stack.Screen name="[id]/tier" options={{ title: "Ticket tier" }} />
      <Stack.Screen name="[id]/section" options={{ title: "Section" }} />
      <Stack.Screen name="[id]/seats" options={{ title: "Seats" }} />
    </Stack>
  );
}
