"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: total === 0,
  };
}

/**
 * Large show countdown (days/hours/minutes/seconds) for the featured show on
 * the landing page.
 */
export function ShowCountdown({ target }: { target: string | Date }) {
  const to = new Date(target).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const p = parts(to - now);
  const cells: [number, string][] = [
    [p.days, "Days"],
    [p.hours, "Hours"],
    [p.minutes, "Min"],
    [p.seconds, "Sec"],
  ];

  if (p.done) {
    return (
      <p className="text-[oklch(0.82_0.14_75)]">
        The concert is on. See you there.
      </p>
    );
  }

  return (
    <div className="flex gap-3 sm:gap-5">
      {cells.map(([v, label]) => (
        <div
          key={label}
          className="flex min-w-[64px] flex-col items-center rounded-lg border border-[oklch(0.3_0.018_250)] bg-[oklch(0.19_0.013_250)] px-3 py-3"
        >
          <span className="font-mono text-3xl font-black tabular-nums sm:text-4xl">
            {String(v).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[11px] tracking-widest text-[oklch(0.6_0.016_250)] uppercase">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Compact MM:SS countdown to a payment window deadline. Calls `onExpire` once
 * when it hits zero (used on the pay/upload-proof screen).
 */
export function PaymentCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string | Date;
  onExpire?: () => void;
}) {
  const to = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = to - now;
  const expired = remaining <= 0;

  useEffect(() => {
    if (expired) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const totalSec = Math.max(0, Math.floor(remaining / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  const urgent = totalSec < 300;

  return (
    <span
      className={`font-mono text-2xl font-black tabular-nums ${
        expired
          ? "text-[oklch(0.72_0.19_25)]"
          : urgent
            ? "text-[oklch(0.72_0.19_25)]"
            : "text-[oklch(0.82_0.14_75)]"
      }`}
    >
      {expired ? "00:00" : `${mm}:${ss}`}
    </span>
  );
}
