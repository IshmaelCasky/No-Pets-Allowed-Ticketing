import Link from "next/link";

/** Centered card on the dark ground for sign in / sign up. */
export default function AuthLayout(props: { children: React.ReactNode }) {
  return (
    <div className="dark flex min-h-screen flex-col items-center justify-center bg-[oklch(0.16_0.012_312)] px-5 py-12 text-[oklch(0.97_0.006_308)]">
      <Link href="/" className="mb-8 font-black tracking-tight uppercase">
        No Pets <span className="text-[oklch(0.72_0.17_348)]">Allowed</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-[oklch(0.3_0.018_310)] bg-[oklch(0.19_0.013_311)] p-8">
        {props.children}
      </div>
    </div>
  );
}
