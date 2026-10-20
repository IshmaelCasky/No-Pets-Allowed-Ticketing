"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "@npa/api";
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
import { toast } from "@npa/ui/toast";

import { formatCentavos } from "~/lib/format";
import { useTRPC } from "~/trpc/react";
import { SeatGrid, SeatLegend } from "./seat-grid";
import { SectionForm } from "./section-form";

type Section = RouterOutputs["seatMap"]["forEvent"]["sections"][number];
type Seat = RouterOutputs["seatMap"]["forEvent"]["seats"][number];

function SectionCard({
  eventId,
  section,
  seats,
  index,
  total,
  onMove,
}: {
  eventId: string;
  section: Section;
  seats: Seat[];
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const invalidate = () =>
    queryClient.invalidateQueries(
      trpc.seatMap.forEvent.queryFilter({ eventId }),
    );

  const setBlocked = useMutation(
    trpc.seatMap.setSeatsBlocked.mutationOptions({
      onSuccess: () => {
        setSelected(new Set());
        void invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const removeSection = useMutation(
    trpc.seatMap.deleteSection.mutationOptions({
      onSuccess: () => {
        toast.success("Section deleted");
        void invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const counts = useMemo(() => {
    const c = { available: 0, held: 0, sold: 0, blocked: 0 };
    for (const s of seats) c[s.status]++;
    return c;
  }, [seats]);

  // Decide whether the selection should be blocked or unblocked: if all
  // selected are currently available, block; otherwise unblock.
  const selectedSeats = seats.filter((s) => selected.has(s.id));
  const allAvailable =
    selectedSeats.length > 0 &&
    selectedSeats.every((s) => s.status === "available");

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: section.color ?? "#6366f1" }}
            />
            {section.name}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatCentavos(section.price)} · {section.rows}×
            {section.seatsPerRow} · {counts.available} available · {counts.sold}{" "}
            sold · {counts.held} held · {counts.blocked} blocked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </Button>
          <SectionForm
            eventId={eventId}
            section={section}
            trigger={
              <Button size="sm" variant="outline">
                Edit
              </Button>
            }
            onDone={() => undefined}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete section?</AlertDialogTitle>
                <AlertDialogDescription>
                  Sections with held or sold seats cannot be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => removeSection.mutate({ id: section.id })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SeatGrid
          seats={seats}
          seatsPerRow={section.seatsPerRow}
          selected={selected}
          onSelectionChange={setSelected}
        />
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm">{selected.size} selected</span>
            <Button
              size="sm"
              disabled={setBlocked.isPending}
              onClick={() =>
                setBlocked.mutate({
                  seatIds: [...selected],
                  blocked: allAvailable,
                })
              }
            >
              {allAvailable ? "Block selected" : "Unblock selected"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GridBuilder({ eventId }: { eventId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.seatMap.forEvent.queryOptions({ eventId }));

  const reorder = useMutation(
    trpc.seatMap.reorderSections.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          trpc.seatMap.forEvent.queryFilter({ eventId }),
        ),
      onError: (e) => toast.error(e.message),
    }),
  );

  const sections = data?.sections ?? [];
  const seatsBySection = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const s of data?.seats ?? []) {
      const list = map.get(s.sectionId) ?? [];
      list.push(s);
      map.set(s.sectionId, list);
    }
    return map;
  }, [data?.seats]);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    reorder.mutate({
      eventId,
      orderedSectionIds: next.map((s) => s.id),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SeatLegend />
        <SectionForm
          eventId={eventId}
          trigger={<Button size="sm">Add section</Button>}
          onDone={() => undefined}
        />
      </div>

      {sections.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No sections yet. Add a section to build the seat map.
          </CardContent>
        </Card>
      ) : (
        sections.map((section, i) => (
          <SectionCard
            key={section.id}
            eventId={eventId}
            section={section}
            seats={seatsBySection.get(section.id) ?? []}
            index={i}
            total={sections.length}
            onMove={(dir) => move(i, dir)}
          />
        ))
      )}
    </div>
  );
}
