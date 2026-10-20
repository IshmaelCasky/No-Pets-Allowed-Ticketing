import { useQuery } from "@tanstack/react-query";

import type { PermissionKey } from "@npa/validators";

import { trpc } from "./api";
import { authClient } from "./auth";

/**
 * Current user's permission keys (from their role). Gates the staff scanner.
 * Returns an empty list while unauthenticated or loading.
 */
export function usePermissions() {
  const { data: session } = authClient.useSession();
  const enabled = !!session?.user;
  const query = useQuery({
    ...trpc.auth.me.queryOptions(),
    enabled,
  });
  const permissions = query.data?.permissions ?? [];
  return {
    permissions,
    has: (key: PermissionKey) => permissions.includes(key),
    isLoading: enabled && query.isLoading,
  };
}
