"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { RouterOutputs } from "@npa/api";
import type { RefundStatus, RejectRefundInput } from "@npa/validators";
import { Button } from "@npa/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@npa/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@npa/ui/dialog";
import { Field, FieldError } from "@npa/ui/field";
import { Input } from "@npa/ui/input";
import { Label } from "@npa/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@npa/ui/select";
import { Textarea } from "@npa/ui/textarea";
import { toast } from "@npa/ui/toast";
import { REFUND_STATUSES, rejectRefundSchema } from "@npa/validators";

import { ImageUploadField } from "~/app/admin/_components/image-upload-field";
import { RefundStatusBadge } from "~/app/admin/_components/status-badge";
import { useListParams } from "~/app/admin/_lib/use-list-params";
import { formatCentavos, formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { isConflict, PAGE_SIZE } from "./lib";

type Refund = RouterOutputs["refund"]["queue"]["items"][number];

const ALL = "__all__";

export function RefundsTab() {
  const trpc = useTRPC();
  const { get, page, setParams, setPage } = useListParams();
  const status = (get("status") as RefundStatus | "") || undefined;

  const { data, isLoading } = useQuery(
    trpc.refund.queue.queryOptions({ page, pageSize: PAGE_SIZE, status }),
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select
          value={status ?? ALL}
          onValueChange={(v) =>
            setParams({ status: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {REFUND_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground ml-auto text-sm">
          {total} requests
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-12 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No refund requests.
        </p>
      ) : (
        <div className="grid gap-4">
          {items.map((refund) => (
            <RefundCard key={refund.id} refund={refund} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function RefundCard({ refund }: { refund: Refund }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [paying, setPaying] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.refund.queue.queryFilter());

  const approve = useMutation(
    trpc.refund.approve.mutationOptions({
      onSuccess: async () => {
        toast.success("Refund approved — tickets voided");
        await invalidate();
      },
      onError: async (err) => {
        if (isConflict(err)) {
          toast.error("This refund was already reviewed");
          await invalidate();
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Refund for order {refund.orderCode ?? refund.orderId}
          <RefundStatusBadge status={refund.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p>
            {refund.eventTitle ?? "Concert"}
            {refund.totalAmount !== null
              ? ` · ${formatCentavos(refund.totalAmount)}`
              : ""}
          </p>
          <p className="text-muted-foreground">
            {refund.buyerName ?? "Unknown buyer"}
            {refund.buyerEmail ? ` · ${refund.buyerEmail}` : ""}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Reason</p>
          <p>{refund.reason}</p>
          <p className="text-muted-foreground mt-2">Requested</p>
          <p>{formatManila(refund.createdAt)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Payout details</p>
          <p>{refund.payoutMethod}</p>
          <p>{refund.payoutAccountName}</p>
          <p className="font-mono">{refund.payoutAccountNumber}</p>
          {refund.payoutReference && (
            <>
              <p className="text-muted-foreground mt-2">Payout reference</p>
              <p className="font-mono">{refund.payoutReference}</p>
            </>
          )}
        </div>
      </CardContent>
      {refund.status === "requested" && (
        <CardFooter className="gap-2">
          <Button
            disabled={approve.isPending}
            onClick={() => approve.mutate({ refundRequestId: refund.id })}
          >
            {approve.isPending ? "Approving…" : "Approve"}
          </Button>
          <Button variant="destructive" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </CardFooter>
      )}
      {refund.status === "approved" && (
        <CardFooter>
          <Button onClick={() => setPaying(true)}>Mark as paid</Button>
        </CardFooter>
      )}

      <RejectRefundDialog
        open={rejecting}
        onOpenChange={setRejecting}
        refundId={refund.id}
        onDone={invalidate}
      />
      <MarkPaidDialog
        open={paying}
        onOpenChange={setPaying}
        refundId={refund.id}
        onDone={invalidate}
      />
    </Card>
  );
}

function RejectRefundDialog({
  open,
  onOpenChange,
  refundId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refundId: string;
  onDone: () => Promise<void>;
}) {
  const trpc = useTRPC();
  const form = useForm<RejectRefundInput>({
    // zodResolver's v3 typings don't line up with our zod/v4 schemas; safe at
    // runtime and the form value type is pinned by the generic above.
    resolver: zodResolver(rejectRefundSchema as never),
    defaultValues: { refundRequestId: refundId, reason: "" },
  });

  const reject = useMutation(
    trpc.refund.reject.mutationOptions({
      onSuccess: async () => {
        toast.success("Refund rejected");
        onOpenChange(false);
        await onDone();
      },
      onError: async (err) => {
        if (isConflict(err)) {
          toast.error("This refund was already reviewed");
          onOpenChange(false);
          await onDone();
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject refund request</DialogTitle>
          <DialogDescription>
            A reason is required. Tickets are left untouched.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) =>
            reject.mutate({ refundRequestId: refundId, reason: values.reason }),
          )}
          className="flex flex-col gap-4"
        >
          <Field>
            <Label htmlFor="refund-reject-reason">Reason</Label>
            <Textarea id="refund-reject-reason" {...form.register("reason")} />
            <FieldError errors={[form.formState.errors.reason]} />
          </Field>
          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={reject.isPending}
            >
              {reject.isPending ? "Rejecting…" : "Reject refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidDialog({
  open,
  onOpenChange,
  refundId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refundId: string;
  onDone: () => Promise<void>;
}) {
  const trpc = useTRPC();
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutProofKey, setPayoutProofKey] = useState("");

  const markPaid = useMutation(
    trpc.refund.markPaid.mutationOptions({
      onSuccess: async () => {
        toast.success("Refund marked as paid — order refunded");
        onOpenChange(false);
        await onDone();
      },
      onError: async (err) => {
        if (isConflict(err)) {
          toast.error("Only an approved refund can be marked paid");
          onOpenChange(false);
          await onDone();
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  const canSubmit = payoutReference.trim() !== "" && payoutProofKey !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark refund as paid</DialogTitle>
          <DialogDescription>
            Upload the transfer receipt and enter the payout reference.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <Label>Transfer receipt</Label>
            <ImageUploadField
              endpoint="refundProof"
              label="Upload receipt"
              onUploaded={({ key }) => setPayoutProofKey(key)}
            />
          </Field>
          <Field>
            <Label htmlFor="payout-reference">Payout reference #</Label>
            <Input
              id="payout-reference"
              value={payoutReference}
              onChange={(e) => setPayoutReference(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={!canSubmit || markPaid.isPending}
            onClick={() =>
              markPaid.mutate({
                refundRequestId: refundId,
                payoutReference,
                payoutProofKey,
              })
            }
          >
            {markPaid.isPending ? "Saving…" : "Mark as paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
