import { Stack } from "expo-router";

/** More stack — header styled like the rest of the app. */
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#c03484" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "More" }} />
    </Stack>
  );
}
