import { Redirect } from "expo-router";

import { Loading } from "~/components/ui";
import { authClient } from "~/utils/auth";

/** Entry gate: send authed users to the tabbed app, others to sign in. */
export default function Index() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <Loading label="Loading…" />;
  if (session?.user) return <Redirect href="/(tabs)/events" />;
  return <Redirect href="/(auth)/sign-in" />;
}
