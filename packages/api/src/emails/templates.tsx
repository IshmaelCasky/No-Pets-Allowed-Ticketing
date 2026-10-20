import { Button, Text } from "@react-email/components";

import { EmailLayout, formatPeso } from "./layout";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000";

function ticketsUrl() {
  return `${APP_URL.replace(/\/$/, "")}/my-tickets`;
}

export function OrderApprovedEmail(props: {
  orderCode: string;
  eventTitle: string;
}) {
  return (
    <EmailLayout
      preview={`Your order ${props.orderCode} is approved`}
      heading="Payment approved 🎟️"
    >
      <Text>
        Your order <strong>{props.orderCode}</strong> for{" "}
        <strong>{props.eventTitle}</strong> has been approved. Your tickets are
        ready.
      </Text>
      <Button
        href={ticketsUrl()}
        style={{
          backgroundColor: "#fafafa",
          color: "#0a0a0a",
          padding: "10px 18px",
          borderRadius: "6px",
          fontWeight: 600,
        }}
      >
        View my tickets
      </Button>
    </EmailLayout>
  );
}

export function OrderRejectedEmail(props: {
  orderCode: string;
  eventTitle: string;
  reason: string;
  canResubmit: boolean;
}) {
  return (
    <EmailLayout
      preview={`Your order ${props.orderCode} was rejected`}
      heading="Payment needs attention"
    >
      <Text>
        Your order <strong>{props.orderCode}</strong> for{" "}
        <strong>{props.eventTitle}</strong> was rejected.
      </Text>
      <Text>
        <strong>Reason:</strong> {props.reason}
      </Text>
      {props.canResubmit ? (
        <Text>
          You may re-upload a corrected receipt once before your payment window
          closes.
        </Text>
      ) : (
        <Text>This order can no longer be resubmitted.</Text>
      )}
    </EmailLayout>
  );
}

export function OrderExpiredEmail(props: {
  orderCode: string;
  eventTitle: string;
}) {
  return (
    <EmailLayout
      preview={`Your order ${props.orderCode} expired`}
      heading="Payment window expired"
    >
      <Text>
        Your order <strong>{props.orderCode}</strong> for{" "}
        <strong>{props.eventTitle}</strong> expired because payment was not
        completed in time. The held seats have been released.
      </Text>
    </EmailLayout>
  );
}

export function RefundApprovedEmail(props: {
  orderCode: string;
  eventTitle: string;
}) {
  return (
    <EmailLayout
      preview={`Refund approved for ${props.orderCode}`}
      heading="Refund approved"
    >
      <Text>
        Your refund request for order <strong>{props.orderCode}</strong> (
        {props.eventTitle}) has been approved. Your tickets are now void and we
        are processing your payout.
      </Text>
    </EmailLayout>
  );
}

export function RefundRejectedEmail(props: {
  orderCode: string;
  eventTitle: string;
  reason: string;
}) {
  return (
    <EmailLayout
      preview={`Refund rejected for ${props.orderCode}`}
      heading="Refund rejected"
    >
      <Text>
        Your refund request for order <strong>{props.orderCode}</strong> (
        {props.eventTitle}) was rejected.
      </Text>
      <Text>
        <strong>Reason:</strong> {props.reason}
      </Text>
    </EmailLayout>
  );
}

export function RefundPaidEmail(props: {
  orderCode: string;
  eventTitle: string;
  amount: number;
  payoutReference: string;
}) {
  return (
    <EmailLayout
      preview={`Refund paid for ${props.orderCode}`}
      heading="Refund paid"
    >
      <Text>
        We have sent your refund of <strong>{formatPeso(props.amount)}</strong>{" "}
        for order <strong>{props.orderCode}</strong> ({props.eventTitle}).
      </Text>
      <Text>
        <strong>Transfer reference:</strong> {props.payoutReference}
      </Text>
    </EmailLayout>
  );
}
