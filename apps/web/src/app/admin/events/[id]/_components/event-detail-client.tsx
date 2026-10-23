"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@npa/ui/alert-dialog";
import { Button } from "@npa/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@npa/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@npa/ui/dialog";
import { toast } from "@npa/ui/toast";

import { formatManila } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { EventForm } from "../../_components/event-form";
import { PageHeader } from "../../../_components/page-header";
import { EventStatusBadge } from "../../../_components/status-badge";
import { downloadCsv } from "../../../_lib/download-csv";
import { GridBuilder } from "./grid-builder";
import { TierEditor } from "./tier-editor";

export function EventDetailClient({ eventId }: { eventId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: event } = useQuery(
    trpc.event.byId.queryOptions({ id: eventId }),
  );
  const { data: tiers } = useQuery(
    trpc.event.tiersByEvent.queryOptions({ eventId }),
  );
  const { data: seatMap } = useQuery(
    trpc.seatMap.forEvent.queryOptions({ eventId }),
  );

  const invalidate = () => {
    void queryClient.invalidateQueries(
      trpc.event.byId.queryFilter({ id: eventId }),
    );
    void queryClient.invalidateQueries(trpc.event.list.queryFilter());
  };

  const update = useMutation(
    trpc.event.update.mutationOptions({
      onSuccess: () => {
        toast.success("Concert updated");
        setEditOpen(false);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const setStatus = useMutation(
    trpc.event.setStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Status updated");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const remove = useMutation(
    trpc.event.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Concert deleted");
        router.push("/admin/events");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (!event) return null;

  // Seating mode is locked once committed inventory exists (orders present).
  const hasCommittedGa = (tiers ?? []).some((t) => t.reserved + t.sold > 0);
  const hasCommittedSeats = (seatMap?.seats ?? []).some(
    (s) => s.status === "held" || s.status === "sold",
  );
  const seatingModeLocked = hasCommittedGa || hasCommittedSeats;

  const publishLabel = event.status === "published" ? "Unpublish" : "Publish";
  const nextStatus = event.status === "published" ? "draft" : "published";

  const exportAttendees = async () => {
    try {
      const csv = await queryClient.fetchQuery(
        trpc.event.attendeesCsv.queryOptions({ id: eventId }),
      );
      downloadCsv(`attendees-${event.slug}.csv`, csv);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div>
      <PageHeader
        title={event.title}
        description={event.venue ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setStatus.mutate({ id: eventId, status: nextStatus })
              }
              disabled={setStatus.isPending}
            >
              {publishLabel}
            </Button>
            <Button variant="outline" onClick={exportAttendees}>
              Export attendees
            </Button>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button>Edit</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit concert</DialogTitle>
                </DialogHeader>
                <EventForm
                  event={event}
                  seatingModeLocked={seatingModeLocked}
                  isPending={update.isPending}
                  onSubmit={(values) =>
                    update.mutate({ id: eventId, ...values })
                  }
                />
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this concert?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone. Concerts with orders cannot be
                    deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => remove.mutate({ id: eventId })}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Details <EventStatusBadge status={event.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Seating mode: </span>
            {event.seatingMode === "ga" ? "General admission" : "Reserved"}
          </div>
          <div>
            <span className="text-muted-foreground">Starts: </span>
            {formatManila(event.startsAt)}
          </div>
          <div>
            <span className="text-muted-foreground">Doors: </span>
            {formatManila(event.doorsOpenAt)}
          </div>
          <div>
            <span className="text-muted-foreground">Max per order: </span>
            {event.maxPerOrder}
          </div>
          <div>
            <span className="text-muted-foreground">Refund cutoff: </span>
            {event.refundCutoffDays} days
          </div>
          <div>
            <span className="text-muted-foreground">Slug: </span>
            {event.slug}
          </div>
        </CardContent>
      </Card>

      {event.seatingMode === "ga" ? (
        <TierEditor eventId={eventId} />
      ) : (
        <GridBuilder eventId={eventId} />
      )}
    </div>
  );
}
