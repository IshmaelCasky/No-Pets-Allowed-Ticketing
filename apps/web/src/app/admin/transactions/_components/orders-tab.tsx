"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "@npa/api";
import type { DataTableColumn } from "@npa/ui/data-table";
import type { OrderStatus } from "@npa/validators";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@npa/ui/alert-dialog";
import { Button } from "@npa/ui/button";
import { DataTable } from "@npa/ui/data-table";
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
import { ORDER_STATUSES } from "@npa/validators";

import { OrderStatusBadge } from "~/app/admin/_components/status-badge";
import { useListParams } from "~/app/admin/_lib/use-list-params";
import { formatCentavos, formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { PAGE_SIZE } from "./lib";

type Order = RouterOutputs["order"]["adminList"]["items"][number];

const ALL = "__all__";
// Matches the API: only unpaid orders can be cancelled.
const CANCELLABLE: OrderStatus[] = ["pending_payment"];

export function OrdersTab() {
  const trpc = useTRPC();
  const { get, page, setParams, setPage } = useListParams();
  const search = get("search");
  const status = (get("status") as OrderStatus | "") || undefined;
  const [cancelling, setCancelling] = useState<Order | null>(null);

  const { data, isLoading } = useQuery(
    trpc.order.adminList.queryOptions({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      status,
    }),
  );

  const columns: DataTableColumn<Order>[] = [
    {
      id: "code",
      header: "Code",
      cell: (o) => <span className="font-mono">{o.code}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (o) => <OrderStatusBadge status={o.status} />,
    },
    {
      id: "amount",
      header: "Amount",
      cell: (o) => formatCentavos(o.totalAmount),
    },
    {
      id: "payment",
      header: "Payment",
      cell: (o) => o.hitpayStatus ?? "—",
    },
    {
      id: "created",
      header: "Created",
      cell: (o) => formatManila(o.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: (o) => (
        <Button
          variant="outline"
          size="sm"
          disabled={!CANCELLABLE.includes(o.status)}
          onClick={() => setCancelling(o)}
        >
          Cancel
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(o) => o.id}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No orders found."
        toolbar={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search code / reference / buyer"
              defaultValue={search}
              className="max-w-xs"
              onChange={(e) => setParams({ search: e.target.value })}
            />
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
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      {cancelling && (
        <CancelDialog order={cancelling} onClose={() => setCancelling(null)} />
      )}
    </>
  );
}

function CancelDialog({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const cancel = useMutation(
    trpc.order.cancel.mutationOptions({
      onSuccess: async () => {
        toast.success(`Order ${order.code} cancelled`);
        await queryClient.invalidateQueries(trpc.order.adminList.queryFilter());
        onClose();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel order {order.code}?</AlertDialogTitle>
          <AlertDialogDescription>
            Held seats or tier inventory will be released. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel-note">Note (optional)</Label>
          <Textarea
            id="cancel-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for cancellation"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>
            Back
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={cancel.isPending}
            onClick={(e) => {
              e.preventDefault();
              cancel.mutate({ id: order.id, note: note || undefined });
            }}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel order"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
