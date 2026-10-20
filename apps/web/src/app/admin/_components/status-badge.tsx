import type {
  EventStatus,
  OrderStatus,
  RefundStatus,
  ScanResult,
  TicketStatus,
} from "@npa/validators";
import { Badge } from "@npa/ui/badge";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

const ORDER_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending_payment: "secondary",
  for_review: "warning",
  approved: "success",
  rejected: "destructive",
  expired: "outline",
  cancelled: "outline",
  refunded: "secondary",
};

const REFUND_VARIANT: Record<RefundStatus, BadgeVariant> = {
  requested: "warning",
  approved: "default",
  rejected: "destructive",
  paid: "success",
};

const EVENT_VARIANT: Record<EventStatus, BadgeVariant> = {
  draft: "outline",
  published: "success",
  ended: "secondary",
  cancelled: "destructive",
};

const TICKET_VARIANT: Record<TicketStatus, BadgeVariant> = {
  active: "success",
  used: "secondary",
  void: "destructive",
};

const SCAN_VARIANT: Record<ScanResult, BadgeVariant> = {
  valid: "success",
  already_used: "warning",
  wrong_event: "destructive",
  void: "destructive",
  not_found: "destructive",
};

function label(s: string) {
  return s.replace(/_/g, " ");
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_VARIANT[status]}>{label(status)}</Badge>;
}

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return <Badge variant={REFUND_VARIANT[status]}>{label(status)}</Badge>;
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={EVENT_VARIANT[status]}>{label(status)}</Badge>;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={TICKET_VARIANT[status]}>{label(status)}</Badge>;
}

export function ScanResultBadge({ result }: { result: ScanResult }) {
  return <Badge variant={SCAN_VARIANT[result]}>{label(result)}</Badge>;
}
