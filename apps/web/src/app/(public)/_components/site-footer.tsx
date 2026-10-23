import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[oklch(0.3_0.018_250)]/70 bg-[oklch(0.14_0.011_250)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black tracking-tight uppercase">No Pets Allowed</p>
          <p className="mt-1 text-[oklch(0.6_0.016_250)]">
            Live music, loud nights. Tickets paid by QR, scanned at the gate.
          </p>
        </div>
        <div className="flex gap-6 text-[oklch(0.72_0.012_250)]">
          <Link href="/events" className="hover:text-white">
            Concerts
          </Link>
          <Link href="/#how-to-buy" className="hover:text-white">
            How to buy
          </Link>
          <Link href="/#faq" className="hover:text-white">
            FAQ
          </Link>
          <Link href="/my-tickets" className="hover:text-white">
            My tickets
          </Link>
        </div>
      </div>
      <div className="border-t border-[oklch(0.3_0.018_250)]/50 py-4 text-center text-xs text-[oklch(0.55_0.014_250)]">
        © {new Date().getFullYear()} No Pets Allowed. All rights reserved.
      </div>
    </footer>
  );
}
