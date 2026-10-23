import { useIsRestoring, useQuery } from "@tanstack/react-query";

import type { PermissionKey } from "@npa/validators";

import { trpc } from "./api";
import { authClient } from "./auth";

/**
 * Current user's permission keys (from their role). Code checks permission
 * KEYS, never role names. Returns an empty list while unauthenticated/loading.
 *
 * `isStaff` = the role grants any permission at all. Staff accounts use the
 * admin section of the app and never the customer tabs (mirrors the web, where
 * staff are kept out of the customer storefront).
 */
export function usePermissions() {
  const { data: session } = authClient.useSession();
  const isRestoring = useIsRestoring();
  const enabled = !!session?.user;
  const query = useQuery({
    ...trpc.auth.me.queryOptions(),
    enabled,
  });
  const permissions = query.data?.permissions ?? [];
  return {
    permissions,
    has: (key: PermissionKey) => permissions.includes(key),
    hasAny: (keys: readonly PermissionKey[]) =>
      keys.some((k) => permissions.includes(k)),
    isStaff: permissions.length > 0,
    /**
     * True until `auth.me` has resolved for a signed-in user. Includes the
     * offline-cache restore on launch (queries sit idle then, so `isLoading`
     * alone would briefly report "no permissions" and route staff to the
     * customer tabs). Not `isPending`: a paused offline query would spin.
     */
    isLoading: enabled && (isRestoring || query.isLoading),
  };
}
