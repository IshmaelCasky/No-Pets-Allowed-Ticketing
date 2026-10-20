import { Redirect, Stack } from "expo-router";

import { authClient } from "~/utils/auth";

export default function AuthLayout() {
  const { data: session } = authClient.useSession();
  if (session?.user) return <Redirect href="/(tabs)/events" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
