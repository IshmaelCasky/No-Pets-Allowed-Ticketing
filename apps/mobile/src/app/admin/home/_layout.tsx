import { Stack } from "expo-router";

/** Dashboard stack — header styled like the rest of the app. */
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2f7de6" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Dashboard" }} />
    </Stack>
  );
}
