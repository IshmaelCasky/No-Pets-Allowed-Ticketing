"use client";

import type { PermissionKey } from "@npa/validators";
import { Checkbox } from "@npa/ui/checkbox";
import { Label } from "@npa/ui/label";
import { PERMISSION_KEYS } from "@npa/validators";

/** Human labels for the `action` half of a permission key. */
const ACTION_LABELS: Record<string, string> = {
  read: "View",
  write: "Create / edit",
  delete: "Delete",
  review: "Review",
  scan: "Scan",
  void: "Void",
  ban: "Ban / unban",
};

/** Human labels for the `resource` half (prefix before ':'). */
const RESOURCE_LABELS: Record<string, string> = {
  events: "Events",
  orders: "Orders",
  refunds: "Refunds",
  payment_methods: "Payment methods",
  tickets: "Tickets",
  users: "Users",
  roles: "Roles",
  audit: "Audit logs",
};

function groupByResource() {
  const groups = new Map<string, PermissionKey[]>();
  for (const key of PERMISSION_KEYS) {
    const [resource] = key.split(":") as [string, string];
    const list = groups.get(resource) ?? [];
    list.push(key);
    groups.set(resource, list);
  }
  return [...groups.entries()];
}

const GROUPS = groupByResource();

export function PermissionChecklist({
  value,
  onChange,
  disabled,
}: {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);

  function toggle(key: PermissionKey, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange([...next]);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {GROUPS.map(([resource, keys]) => (
        <div key={resource} className="rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">
            {RESOURCE_LABELS[resource] ?? resource}
          </p>
          <div className="flex flex-col gap-2">
            {keys.map((key) => {
              const [, action] = key.split(":") as [string, string];
              return (
                <Label
                  key={key}
                  className="text-muted-foreground font-normal"
                  htmlFor={`perm-${key}`}
                >
                  <Checkbox
                    id={`perm-${key}`}
                    checked={selected.has(key)}
                    disabled={disabled}
                    onCheckedChange={(c) => toggle(key, c === true)}
                  />
                  {ACTION_LABELS[action] ?? action}
                </Label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
