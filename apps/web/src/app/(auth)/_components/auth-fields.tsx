import { cn } from "@npa/ui";

/** Dark-ground text input used across the auth forms. */
export function DarkInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-[oklch(0.3_0.018_310)] bg-[oklch(0.16_0.012_312)] px-3.5 py-2.5 text-sm text-white placeholder:text-[oklch(0.55_0.014_309)] focus-visible:border-[oklch(0.62_0.21_350)] focus-visible:ring-[3px] focus-visible:ring-[oklch(0.62_0.21_350)]/40 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-[oklch(0.82_0.012_309)]">
      {children}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-[oklch(0.72_0.19_25)]">{message}</p>;
}
