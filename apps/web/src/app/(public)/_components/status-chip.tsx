import {
  ORDER_STATUS_META,
  REFUND_STATUS_META,
  TICKET_STATUS_META,
} from "../_theme/tokens";

const META = {
  order: ORDER_STATUS_META,
  ticket: TICKET_STATUS_META,
  refund: REFUND_STATUS_META,
} as const;

/** A small status pill used on orders, tickets and refunds. */
export function StatusChip({
  kind,
  status,
}: {
  kind: keyof typeof META;
  status: string;
}) {
  const meta = META[kind][status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        meta?.className ??
        "bg-[oklch(0.3_0.018_250)] text-[oklch(0.68_0.018_250)]"
      }`}
    >
      {meta?.label ?? status}
    </span>
  );
}
