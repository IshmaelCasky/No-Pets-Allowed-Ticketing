/**
 * Status → label / Pill tone maps for the Dashboard, Transactions and Gate
 * modules. Colours follow the scanner overlay: green valid, amber already
 * used, red everything else.
 */
import type { RefundStatus, ScanResult } from "@npa/validators";

import type { Tone } from "~/components/admin";

export const SCAN_RESULT_LABEL: Record<ScanResult, string> = {
  valid: "Valid",
  already_used: "Already used",
  wrong_event: "Wrong concert",
  void: "Void",
  not_found: "Not found",
};

export const SCAN_RESULT_TONE: Record<ScanResult, Tone> = {
  valid: "green",
  already_used: "amber",
  wrong_event: "red",
  void: "red",
  not_found: "red",
};

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

export const REFUND_STATUS_TONE: Record<RefundStatus, Tone> = {
  requested: "amber",
  approved: "blue",
  rejected: "red",
  paid: "green",
};

/** HitPay payment-request status (free text from HitPay) → readable label. */
export function hitpayLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}
