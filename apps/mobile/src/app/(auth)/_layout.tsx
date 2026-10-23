import { Redirect, Stack } from "expo-router";

import { authClient } from "~/utils/auth";

export default function AuthLayout() {
  const { data: session } = authClient.useSession();
  // Signed in → the entry gate decides: staff to /admin, customers to the store.
  if (session?.user) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
