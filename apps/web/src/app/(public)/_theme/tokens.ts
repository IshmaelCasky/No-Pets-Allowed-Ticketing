/**
 * Shared visual tokens for the customer-facing "No Pets Allowed" surfaces
 * (public + customer + auth). One source of truth for the dark concert
 * aesthetic so the landing, events, checkout, tickets and account screens all
 * read as the same show. Admin keeps the neutral shadcn theme untouched.
 *
 * The app's base tokens (packages/tailwind-config) already center on a magenta
 * primary (hue ~350). We lean into that as the stage light and pair it with a
 * near-black "venue" ground and a warm amber used only for time/urgency.
 */

/** The dark stage ground applied to every customer surface. */
export const stage = {
  /** Page background: deep near-black with a faint magenta cast. */
  bg: "bg-[oklch(0.16_0.012_312)] text-[oklch(0.97_0.006_308)]",
  /** A slightly raised panel/card on the stage. */
  panel:
    "bg-[oklch(0.21_0.014_311)] border border-[oklch(0.3_0.018_310)] rounded-xl",
  /** Hairline divider that reads on the dark ground. */
  hairline: "border-[oklch(0.3_0.018_310)]",
  /** Muted copy on the dark ground. */
  muted: "text-[oklch(0.68_0.018_309)]",
} as const;

/** The electric magenta stage light — the single bold accent. */
export const accent = {
  text: "text-[oklch(0.72_0.17_348)]",
  bg: "bg-[oklch(0.62_0.21_350)]",
  bgHover: "hover:bg-[oklch(0.68_0.2_349)]",
  ring: "focus-visible:ring-[oklch(0.62_0.21_350)]/50",
  border: "border-[oklch(0.62_0.21_350)]",
} as const;

/** Warm amber, reserved for time + urgency (countdowns, doors, windows). */
export const amber = {
  text: "text-[oklch(0.82_0.14_75)]",
  bg: "bg-[oklch(0.82_0.14_75)]",
} as const;

/** Display heading: heavy, tight, loud. Pairs with the Geist sans body. */
export const display =
  "font-sans font-black tracking-tight leading-[0.95] uppercase";

/** Primary CTA button classes for the dark ground. */
export const ctaPrimary =
  "inline-flex items-center justify-center rounded-full bg-[oklch(0.62_0.21_350)] px-7 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[oklch(0.68_0.2_349)] focus-visible:ring-[3px] focus-visible:ring-[oklch(0.62_0.21_350)]/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

/** Secondary/ghost CTA on the dark ground. */
export const ctaGhost =
  "inline-flex items-center justify-center rounded-full border border-[oklch(0.35_0.02_310)] px-7 py-3 text-sm font-semibold tracking-wide text-[oklch(0.97_0.006_308)] transition-colors hover:border-[oklch(0.62_0.21_350)] hover:text-[oklch(0.82_0.17_348)]";

/** Status → label + color for order/ticket chips across customer screens. */
export const ORDER_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  pending_payment: {
    label: "Awaiting payment",
    className: "bg-[oklch(0.82_0.14_75)]/15 text-[oklch(0.82_0.14_75)]",
  },
  for_review: {
    label: "In review",
    className: "bg-[oklch(0.7_0.12_250)]/15 text-[oklch(0.78_0.12_250)]",
  },
  approved: {
    label: "Approved",
    className: "bg-[oklch(0.7_0.17_155)]/15 text-[oklch(0.78_0.16_155)]",
  },
  rejected: {
    label: "Rejected",
    className: "bg-[oklch(0.64_0.21_25)]/15 text-[oklch(0.72_0.19_25)]",
  },
  expired: {
    label: "Expired",
    className: "bg-[oklch(0.3_0.018_310)] text-[oklch(0.68_0.018_309)]",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-[oklch(0.3_0.018_310)] text-[oklch(0.68_0.018_309)]",
  },
  refunded: {
    label: "Refunded",
    className: "bg-[oklch(0.72_0.17_348)]/15 text-[oklch(0.72_0.17_348)]",
  },
};

export const TICKET_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-[oklch(0.7_0.17_155)]/15 text-[oklch(0.78_0.16_155)]",
  },
  used: {
    label: "Checked in",
    className: "bg-[oklch(0.3_0.018_310)] text-[oklch(0.68_0.018_309)]",
  },
  void: {
    label: "Void",
    className: "bg-[oklch(0.64_0.21_25)]/15 text-[oklch(0.72_0.19_25)]",
  },
};

export const REFUND_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  requested: {
    label: "Requested",
    className: "bg-[oklch(0.82_0.14_75)]/15 text-[oklch(0.82_0.14_75)]",
  },
  approved: {
    label: "Approved — payout pending",
    className: "bg-[oklch(0.7_0.12_250)]/15 text-[oklch(0.78_0.12_250)]",
  },
  rejected: {
    label: "Rejected",
    className: "bg-[oklch(0.64_0.21_25)]/15 text-[oklch(0.72_0.19_25)]",
  },
  paid: {
    label: "Paid",
    className: "bg-[oklch(0.7_0.17_155)]/15 text-[oklch(0.78_0.16_155)]",
  },
};
