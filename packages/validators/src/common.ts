import { z } from "zod/v4";

/** A cuid2 id — treated as a non-empty string here. */
export const idSchema = z.string().min(1);

/** Positive integer amount of money, stored as centavos. */
export const centavosSchema = z
  .number()
  .int("Amount must be a whole number of centavos")
  .nonnegative();

/** Reference to a single entity by id. */
export const byIdSchema = z.object({ id: idSchema });

/** Server-side pagination + search + sort, shared by all admin list screens. */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().max(64).optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
