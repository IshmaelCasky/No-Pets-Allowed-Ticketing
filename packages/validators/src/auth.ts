import { z } from "zod/v4";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required").max(128),
});
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * One-time privileged-account claim (the /setup and /developer routes). Each
 * kind can be claimed exactly once; the API rejects a claim if the account
 * already exists.
 */
export const accountKindSchema = z.enum(["super_admin", "developer"]);
export type AccountKind = z.infer<typeof accountKindSchema>;

export const claimAccountSchema = z.object({
  kind: accountKindSchema,
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});
export type ClaimAccountInput = z.infer<typeof claimAccountSchema>;
