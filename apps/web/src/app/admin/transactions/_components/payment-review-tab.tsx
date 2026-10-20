"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { RouterOutputs } from "@npa/api";
import type { RejectOrderInput } from "@npa/validators";
import { Badge } from "@npa/ui/badge";
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
import { Label } from "@npa/ui/label";
import { Textarea } from "@npa/ui/textarea";
import { toast } from "@npa/ui/toast";
import { rejectOrderSchema } from "@npa/validators";

import { useListParams } from "~/app/admin/_lib/use-list-params";
import { formatCentavos, formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { EventFilter } from "./event-filter";
import { isConflict, PAGE_SIZE, uploadThingUrl } from "./lib";

type QueueItem = RouterOutputs["review"]["queue"]["items"][number];

export function PaymentReviewTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { get, page, setParams, setPage } = useListParams();
  const eventId = get("eventId") || undefined;

  const queueInput = { page, pageSize: PAGE_SIZE, eventId };
  const { data, isLoading } = useQuery(
    trpc.review.queue.queryOptions(queueInput),
  );

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.review.queue.queryFilter());

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <EventFilter
          value={eventId ?? ""}
          onChange={(id) => setParams({ eventId: id })}
        />
        <p className="text-muted-foreground ml-auto text-sm">
          {total} awaiting review
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-12 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No orders awaiting review.
        </p>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <ReviewCard key={item.order.id} item={item} onDone={invalidate} />
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

function ReviewCard({
  item,
  onDone,
}: {
  item: QueueItem;
  onDone: () => Promise<void>;
}) {
  const trpc = useTRPC();
  const [zoom, setZoom] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const { order, isDuplicateReference } = item;

  const approve = useMutation(
    trpc.review.approve.mutationOptions({
      onSuccess: async () => {
        toast.success(`Order ${order.code} approved`);
        await onDone();
      },
      onError: async (err) => {
        if (isConflict(err)) {
          toast.error("This order was already reviewed");
          await onDone();
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  const reject = useMutation(
    trpc.review.reject.mutationOptions({
      onSuccess: async () => {
        toast.success(`Order ${order.code} rejected`);
        setRejecting(false);
        await onDone();
      },
      onError: async (err) => {
        if (isConflict(err)) {
          toast.error("This order was already reviewed");
          setRejecting(false);
          await onDone();
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  const pending = approve.isPending || reject.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {order.code}
          {isDuplicateReference && (
            <Badge variant="destructive">Duplicate reference</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row">
        {order.proofImageKey ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uploadThingUrl(order.proofImageKey)}
              alt={`Receipt for ${order.code}`}
              onClick={() => setZoom(true)}
              className="h-48 w-48 shrink-0 cursor-zoom-in rounded-md border object-cover"
            />
            <Dialog open={zoom} onOpenChange={setZoom}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Receipt — {order.code}</DialogTitle>
                </DialogHeader>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadThingUrl(order.proofImageKey)}
                  alt={`Receipt for ${order.code}`}
                  className="max-h-[70vh] w-full object-contain"
                />
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <div className="bg-muted text-muted-foreground flex h-48 w-48 shrink-0 items-center justify-center rounded-md text-sm">
            No receipt
          </div>
        )}

        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Expected amount</dt>
          <dd className="font-medium">{formatCentavos(order.totalAmount)}</dd>
          <dt className="text-muted-foreground">Reference #</dt>
          <dd className="font-mono">{order.referenceNumber ?? "—"}</dd>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{formatManila(order.submittedAt)}</dd>
          <dt className="text-muted-foreground">Resubmissions</dt>
          <dd>{order.resubmitCount}</dd>
        </dl>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          disabled={pending}
          onClick={() => approve.mutate({ orderId: order.id })}
        >
          {approve.isPending ? "Approving…" : "Approve"}
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => setRejecting(true)}
        >
          Reject
        </Button>
      </CardFooter>

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        orderCode={order.code}
        isPending={reject.isPending}
        onSubmit={(reason) => reject.mutate({ orderId: order.id, reason })}
      />
    </Card>
  );
}

function RejectDialog({
  open,
  onOpenChange,
  orderCode,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCode: string;
  isPending: boolean;
  onSubmit: (reason: string) => void;
}) {
  const form = useForm<RejectOrderInput>({
    // zodResolver's v3 typings don't line up with our zod/v4 schemas; safe at
    // runtime and the form value type is pinned by the generic above.
    resolver: zodResolver(rejectOrderSchema as never),
    defaultValues: { orderId: "", reason: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject order {orderCode}</DialogTitle>
          <DialogDescription>
            A reason is required. The customer may re-upload once before the
            payment window closes.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => onSubmit(values.reason))}
          className="flex flex-col gap-4"
        >
          <Field>
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              {...form.register("reason")}
              placeholder="e.g. Reference number doesn't match the receipt"
            />
            <FieldError errors={[form.formState.errors.reason]} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Rejecting…" : "Reject order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
