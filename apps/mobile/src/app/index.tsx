import { Redirect } from "expo-router";

import { Loading } from "~/components/ui";
import { authClient } from "~/utils/auth";
import { usePermissions } from "~/utils/use-permissions";

/**
 * Entry gate: staff/admin accounts → admin section, customers → the tabbed
 * storefront, signed-out users → sign in.
 */
export default function Index() {
  const { data: session, isPending } = authClient.useSession();
  const { isStaff, isLoading } = usePermissions();
  if (isPending || isLoading) return <Loading label="Loading…" />;
  if (!session?.user) return <Redirect href="/(auth)/sign-in" />;
  if (isStaff) return <Redirect href="/admin" />;
  return <Redirect href="/(tabs)/events" />;
}
