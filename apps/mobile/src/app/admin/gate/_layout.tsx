import { Stack } from "expo-router";

/** Gate stack — Scanner | Check-ins | Scan log live in `index`. */
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2f7de6" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Gate" }} />
    </Stack>
  );
}
