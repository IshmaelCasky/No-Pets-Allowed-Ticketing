"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { SignInInput } from "@npa/validators";
import { toast } from "@npa/ui/toast";
import { signInSchema } from "@npa/validators";

import { authClient } from "~/auth/client";
import { DarkInput, FieldError, FieldLabel } from "../_components/auth-fields";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/my-tickets";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      toast.error(error.message ?? "Could not sign in");
      return;
    }
    toast.success("Signed in");
    router.push(redirect);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-[oklch(0.62_0.21_350)] px-6 py-2.5 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_349)] disabled:opacity-50"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
