import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { RequirePerm } from "~/components/admin";
import { EventForm } from "~/components/events-admin/event-form";
import { useConcertInventory } from "~/components/events-admin/use-inventory";
import { Empty, Loading } from "~/components/ui";
import { trpc } from "~/utils/api";
import { showError } from "~/utils/feedback";

function EditConcert({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const eventQ = useQuery(trpc.event.byId.queryOptions({ id }));
  const { seatingModeLocked } = useConcertInventory(id, { live: false });

  const update = useMutation(
    trpc.event.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.event.byId.queryFilter({ id }));
        void queryClient.invalidateQueries(trpc.event.list.pathFilter());
        router.back();
      },
      onError: (e) => showError(e, "Couldn't save concert"),
    }),
  );

  if (eventQ.isLoading) return <Loading />;
  if (!eventQ.data) return <Empty title="Concert not found" />;

  return (
    <EventForm
      // Remount with fresh defaults if the record changes underneath.
      key={eventQ.data.id}
      initial={eventQ.data}
      seatingModeLocked={seatingModeLocked}
      submitLabel="Save changes"
      submitting={update.isPending}
      onSubmit={(values) =>
        update.mutate({
          id,
          ...values,
          // Don't send an unchanged mode once locked (API rejects changes).
          seatingMode: seatingModeLocked ? undefined : values.seatingMode,
        })
      }
    />
  );
}

export default function EditConcertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequirePerm anyOf={["events:write"]}>
      <EditConcert id={id} />
    </RequirePerm>
  );
}
