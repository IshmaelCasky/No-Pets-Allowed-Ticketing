"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { AccountKind, ClaimAccountInput } from "@npa/validators";
import { toast } from "@npa/ui/toast";
import { claimAccountSchema } from "@npa/validators";

import { useTRPC } from "~/trpc/react";
import { DarkInput, FieldError, FieldLabel } from "./auth-fields";

type FormValues = Omit<ClaimAccountInput, "kind">;

/**
 * One-time privileged-account claim form (the /setup and /developer routes).
 * The real lock lives in the API (`setup.claim` rejects once a holder exists);
 * this just mirrors it and hides the form once claimed.
 */
export function ClaimAccount({
  kind,
  label,
}: {
  kind: AccountKind;
  label: string;
}) {
  const trpc = useTRPC();
  const router = useRouter();

  const status = useQuery(trpc.setup.status.queryOptions());
  const claimed =
    kind === "super_admin"
      ? status.data?.superAdminClaimed
      : status.data?.developerClaimed;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(claimAccountSchema.omit({ kind: true })),
  });

  const claim = useMutation(
    trpc.setup.claim.mutationOptions({
      onSuccess: () => {
        toast.success(`${label} account created — sign in to continue`);
        router.push("/login");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (status.isLoading) {
    return (
      <p className="mt-6 text-sm text-[oklch(0.68_0.018_250)]">Checking…</p>
    );
  }

  if (claimed) {
    return (
      <div className="mt-6 rounded-xl border border-[oklch(0.3_0.02_250)] bg-[oklch(0.2_0.02_250)] p-5">
        <p className="text-sm font-semibold text-white">
          The {label} account has already been set up.
        </p>
        <p className="mt-1 text-sm text-[oklch(0.68_0.018_250)]">
          This page is now locked. Use the sign-in page instead.
        </p>
      </div>
    );
  }

  const onSubmit = handleSubmit((values) => claim.mutate({ ...values, kind }));

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <FieldLabel>Name</FieldLabel>
        <DarkInput
          autoComplete="name"
          placeholder="Full name"
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <FieldLabel>Email</FieldLabel>
        <DarkInput
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>
      <div>
        <FieldLabel>Password</FieldLabel>
        <DarkInput
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <button
        type="submit"
        disabled={claim.isPending}
        className="w-full rounded-full bg-[oklch(0.62_0.21_250)] px-6 py-2.5 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_250)] disabled:opacity-50"
      >
        {claim.isPending ? "Creating…" : `Create ${label} account`}
      </button>
    </form>
  );
}
