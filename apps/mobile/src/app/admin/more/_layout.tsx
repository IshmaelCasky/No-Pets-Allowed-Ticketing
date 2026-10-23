import { Stack } from "expo-router";

/** More stack — header styled like the rest of the app. */
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2f7de6" },
        headerTintColor: "#ffffff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "More" }} />
      {/* User Management · Role Management · Audit Logs (mobile-people) */}
      <Stack.Screen name="users/index" options={{ title: "Users" }} />
      <Stack.Screen name="users/new" options={{ title: "New staff account" }} />
      <Stack.Screen name="users/[id]" options={{ title: "User" }} />
      <Stack.Screen name="roles/index" options={{ title: "Roles" }} />
      <Stack.Screen name="roles/new" options={{ title: "New role" }} />
      <Stack.Screen name="roles/[id]" options={{ title: "Role" }} />
      <Stack.Screen name="audit/index" options={{ title: "Audit logs" }} />
      <Stack.Screen name="audit/[id]" options={{ title: "Audit entry" }} />
    </Stack>
  );
}
