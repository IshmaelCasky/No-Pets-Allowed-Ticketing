import { Redirect } from "expo-router";

import { Loading } from "~/components/ui";
import { ADMIN_TABS } from "~/utils/admin-tabs";
import { usePermissions } from "~/utils/use-permissions";

/** Land on the first admin tab this role can open (else the More menu). */
export default function AdminIndex() {
  const { hasAny, isLoading } = usePermissions();
  if (isLoading) return <Loading />;
  const first = ADMIN_TABS.find((t) => hasAny(t.anyOf));
  return <Redirect href={first ? `/admin/${first.name}` : "/admin/more"} />;
}
