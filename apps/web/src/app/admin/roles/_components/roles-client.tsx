"use client";

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
import { Badge } from "@npa/ui/badge";
import { Button } from "@npa/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@npa/ui/card";
import { toast } from "@npa/ui/toast";

import { useTRPC } from "~/trpc/react";
import { RoleFormDialog } from "./role-form-dialog";

export function RolesClient() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: roles, isLoading } = useQuery(trpc.role.list.queryOptions());

  const deleteMutation = useMutation(
    trpc.role.delete.mutationOptions({
      onSuccess: async () => {
        toast.success("Role deleted");
        await queryClient.invalidateQueries(trpc.role.list.queryFilter());
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RoleFormDialog mode="create" trigger={<Button>Create role</Button>} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles?.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {role.name}
                      {role.isSystem && <Badge variant="outline">System</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {role.description ?? "No description"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {role.memberCount} member
                    {role.memberCount === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="secondary">
                    {role.permissions.length} permission
                    {role.permissions.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <RoleFormDialog
                    mode="edit"
                    initial={{
                      id: role.id,
                      name: role.name,
                      description: role.description,
                      permissions: role.permissions,
                    }}
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={role.isSystem}
                      >
                        Edit
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={role.isSystem || role.memberCount > 0}
                      >
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {role.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: role.id })}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
