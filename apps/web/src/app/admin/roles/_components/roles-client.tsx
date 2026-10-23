"use client";

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
import { Badge } from "@npa/ui/badge";
import { Button } from "@npa/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@npa/ui/table";
import { toast } from "@npa/ui/toast";

import { useTRPC } from "~/trpc/react";
import { RESOURCE_LABELS } from "./permission-checklist";
import { RoleFormDialog } from "./role-form-dialog";

type Role = RouterOutputs["role"]["list"][number];

/** Which areas a role can touch, e.g. "Orders, Refunds, Tickets". */
function resourceSummary(permissions: Role["permissions"]): string[] {
  const resources = new Set(permissions.map((p) => p.split(":")[0] ?? p));
  return [...resources].map((r) => RESOURCE_LABELS[r] ?? r);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">
                Description
              </TableHead>
              <TableHead>Access</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : !roles?.length ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  No roles yet.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => {
                const areas = resourceSummary(role.permissions);
                const deleteBlocked = role.isSystem || role.memberCount > 0;
                return (
                  <TableRow key={role.id}>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-2 font-medium">
                        {role.name}
                        {role.isSystem && (
                          <Badge variant="outline">System</Badge>
                        )}
                      </div>
                      {/* Description moves under the name on small screens. */}
                      <p className="text-muted-foreground mt-1 max-w-xs text-xs whitespace-normal md:hidden">
                        {role.description ?? "No description"}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden max-w-sm align-top whitespace-normal md:table-cell">
                      {role.description ?? "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <p className="text-sm">
                        {plural(role.permissions.length, "permission")}
                      </p>
                      <p className="text-muted-foreground max-w-xs text-xs whitespace-normal">
                        {areas.length ? areas.join(", ") : "No access"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">
                      {role.memberCount}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-2">
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
                              title={
                                role.isSystem
                                  ? "System roles can't be edited"
                                  : undefined
                              }
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
                              disabled={deleteBlocked}
                              title={
                                role.isSystem
                                  ? "System roles can't be deleted"
                                  : role.memberCount > 0
                                    ? "Reassign its members first"
                                    : undefined
                              }
                            >
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete {role.name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  deleteMutation.mutate({ id: role.id })
                                }
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
