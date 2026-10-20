"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { SignUpInput } from "@npa/validators";
import { toast } from "@npa/ui/toast";
import { signUpSchema } from "@npa/validators";

import { authClient } from "~/auth/client";
import { DarkInput, FieldError, FieldLabel } from "../_components/auth-fields";

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/my-tickets";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = handleSubmit(async (values) => {
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      // `phone` is a better-auth additional field on the user table.
      ...(values.phone ? { phone: values.phone } : {}),
    });
    if (error) {
      toast.error(error.message ?? "Could not create your account");
      return;
    }
    toast.success("Account created");
    router.push(redirect);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <FieldLabel>Name</FieldLabel>
        <DarkInput
          autoComplete="name"
          placeholder="Juan dela Cruz"
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
        <FieldLabel>Phone (optional)</FieldLabel>
        <DarkInput
          type="tel"
          autoComplete="tel"
          placeholder="09xx xxx xxxx"
          {...register("phone")}
        />
        <FieldError message={errors.phone?.message} />
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
        disabled={isSubmitting}
        className="w-full rounded-full bg-[oklch(0.62_0.21_350)] px-6 py-2.5 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_349)] disabled:opacity-50"
      >
        {isSubmitting ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
