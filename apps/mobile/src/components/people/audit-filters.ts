import { useSyncExternalStore } from "react";

import type { RouterInputs } from "~/utils/api";

/** Filter values as typed in the UI (strings; empty = not set). */
export interface AuditFilterState {
  actorId: string;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string;
  /** `YYYY-MM-DD`, a calendar day in Asia/Manila. */
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilterState = {
  actorId: "",
  actorLabel: "",
  action: "",
  entityType: "",
  entityId: "",
  dateFrom: "",
  dateTo: "",
};

/*
 * In-memory filter store shared by the list and the detail screen (so "show
 * everything by this actor / for this entity" on the detail can set filters
 * and go back). Never persisted.
 */
let state: AuditFilterState = EMPTY_AUDIT_FILTERS;
const listeners = new Set<() => void>();

export function setAuditFilters(
  next: AuditFilterState | ((prev: AuditFilterState) => AuditFilterState),
) {
  state = typeof next === "function" ? next(state) : next;
  for (const l of listeners) l();
}

export function useAuditFilters(): AuditFilterState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDay(s: string): boolean {
  if (!DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00+08:00`);
  return !Number.isNaN(d.getTime());
}

type AuditListInput = Omit<RouterInputs["audit"]["list"], "page">;

/**
 * Build the `audit.list` / `audit.exportCsv` input. Dates are whole Manila
 * days: From = 00:00 PHT, To = 23:59:59.999 PHT (inclusive).
 */
export function toAuditInput(f: AuditFilterState): AuditListInput {
  const t = (s: string) => s.trim() || undefined;
  const from = t(f.dateFrom);
  const to = t(f.dateTo);
  return {
    pageSize: 30,
    actorId: t(f.actorId),
    action: t(f.action),
    entityType: t(f.entityType),
    entityId: t(f.entityId),
    dateFrom:
      from && isValidDay(from) ? new Date(`${from}T00:00:00+08:00`) : undefined,
    dateTo:
      to && isValidDay(to) ? new Date(`${to}T23:59:59.999+08:00`) : undefined,
  };
}

export function activeFilterCount(f: AuditFilterState): number {
  return [
    f.actorId,
    f.action,
    f.entityType,
    f.entityId,
    f.dateFrom,
    f.dateTo,
  ].filter((v) => v.trim() !== "").length;
}
