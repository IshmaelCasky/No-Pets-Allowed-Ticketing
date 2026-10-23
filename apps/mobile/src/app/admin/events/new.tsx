import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { RequirePerm } from "~/components/admin";
import { EventForm } from "~/components/events-admin/event-form";
import { trpc } from "~/utils/api";
import { showError } from "~/utils/feedback";

function NewConcert() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const create = useMutation(
    trpc.event.create.mutationOptions({
      onSuccess: (row) => {
        void queryClient.invalidateQueries(trpc.event.list.queryFilter());
        router.replace({
          pathname: "/admin/events/[id]",
          params: { id: row.id },
        });
      },
      onError: (e) => showError(e, "Couldn't create concert"),
    }),
  );

  return (
    <EventForm
      submitLabel="Create concert (draft)"
      submitting={create.isPending}
      onSubmit={(values) => create.mutate({ ...values, status: "draft" })}
    />
  );
}

export default function NewConcertScreen() {
  return (
    <RequirePerm anyOf={["events:write"]}>
      <NewConcert />
    </RequirePerm>
  );
}
