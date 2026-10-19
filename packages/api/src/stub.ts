import { TRPCError } from "@trpc/server";

/**
 * Placeholder body for a stubbed procedure. The router SIGNATURES (inputs +
 * annotated return types) are the Phase-1 contract that UI agents code
 * against; the `api-builder` agent replaces these bodies with real logic in
 * Phase 2. Returns `never`, so it satisfies any annotated return type.
 */
export function notImplemented(name?: string): never {
  throw new TRPCError({
    code: "NOT_IMPLEMENTED",
    message: `${name ?? "This procedure"} is not implemented yet`,
  });
}

/** Standard shape returned by every server-paginated admin list. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
