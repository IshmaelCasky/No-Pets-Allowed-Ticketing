import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { SQL } from "@npa/db";
import type { db as dbClient } from "@npa/db/client";
import type { Event, ScanLog, Ticket } from "@npa/db/schema";
import type {
  ListCheckinsInput,
  ListScanLogsInput,
  ScanResult,
} from "@npa/validators";
import {
  alias,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  ne,
  or,
  sql,
} from "@npa/db";
import {
  event,
  order,
  scanLog,
  seat,
  ticket,
  ticketTier,
  user,
} from "@npa/db/schema";
import {
  idSchema,
  listCheckinsSchema,
  listScanLogsSchema,
  paginationSchema,
  scanTicketSchema,
} from "@npa/validators";

import type { Paginated } from "../stub";
import { toCsv } from "../lib";
import { permissionProcedure } from "../trpc";

/** Outcome of a scan. `already_used` includes when and by whom. */
export interface ScanResponse {
  result: ScanResult;
  /** The scanned ticket, without its token (the QR value). */
  ticket: Omit<Ticket, "token"> | null;
  usedAt: Date | null;
  usedByName: string | null;
}

/** Drop the token (the QR value) before a ticket leaves the server. */
function withoutToken(t: Ticket): Omit<Ticket, "token"> {
  const { token, ...rest } = t;
  void token;
  return rest;
}

/** Scanner history row: a scan log without the raw value (see `history`). */
export type ScanHistoryRow = Omit<ScanLog, "rawValue"> & {
  rawValuePreview: string | null;
};

/** One live (non-void) ticket on the Check-ins tab. */
export interface CheckinRow {
  ticketId: string;
  status: Ticket["status"];
  holderName: string | null;
  buyerName: string | null;
  /** Null unless the viewer has `orders:read` or `users:read`. */
  buyerEmail: string | null;
  orderCode: string;
  tierName: string | null;
  seatLabel: string | null;
  usedAt: Date | null;
  usedByName: string | null;
}

/** Check-ins page plus event-wide counts (not affected by filters/search). */
export interface CheckinsPage extends Paginated<CheckinRow> {
  checkedIn: number;
  totalTickets: number;
}

/**
 * One scan attempt on the Scan log tab. The raw scanned value is only shown
 * for unknown codes (`not_found`); for real tickets it IS the ticket token, so
 * it is never sent back to the client.
 */
export interface ScanLogRow {
  id: string;
  createdAt: Date;
  result: ScanResult;
  eventId: string;
  eventTitle: string | null;
  ticketId: string | null;
  holderName: string | null;
  buyerName: string | null;
  orderCode: string | null;
  tierName: string | null;
  seatLabel: string | null;
  scannedById: string;
  scannedByName: string | null;
  device: string | null;
  rawValuePreview: string | null;
}

/** Event choice for the Scans module pickers (scanners lack events:read). */
export type ScanEventOption = Pick<
  Event,
  "id" | "title" | "startsAt" | "status"
>;

type Db = typeof dbClient;

const buyer = alias(user, "buyer");
const usedBy = alias(user, "used_by");
const scannedBy = alias(user, "scanned_by");

/**
 * Buyer emails are customer contact data: only roles that already see
 * customers (`orders:read` / `users:read`) get them, or can search by them.
 * Gate scanners (`tickets:scan` only) see names, codes and seats.
 */
function canSeeEmails(permissions: Set<string>): boolean {
  return permissions.has("orders:read") || permissions.has("users:read");
}

function checkinFilters(input: ListCheckinsInput, withEmail: boolean): SQL[] {
  const filters: SQL[] = [
    eq(ticket.eventId, input.eventId),
    ne(ticket.status, "void"),
  ];
  if (input.status === "checked_in") filters.push(eq(ticket.status, "used"));
  if (input.status === "not_checked_in")
    filters.push(eq(ticket.status, "active"));
  if (input.search) {
    const q = `%${input.search}%`;
    const match = or(
      ilike(ticket.holderName, q),
      ilike(buyer.name, q),
      withEmail ? ilike(buyer.email, q) : undefined,
      ilike(order.code, q),
      ilike(seat.label, q),
    );
    if (match) filters.push(match);
  }
  return filters;
}

function checkinQuery(db: Db, where: SQL) {
  return db
    .select({
      ticketId: ticket.id,
      status: ticket.status,
      holderName: ticket.holderName,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      orderCode: order.code,
      tierName: ticketTier.name,
      seatLabel: seat.label,
      usedAt: ticket.usedAt,
      usedByName: usedBy.name,
    })
    .from(ticket)
    .innerJoin(order, eq(ticket.orderId, order.id))
    .leftJoin(buyer, eq(order.userId, buyer.id))
    .leftJoin(ticketTier, eq(ticket.tierId, ticketTier.id))
    .leftJoin(seat, eq(ticket.seatId, seat.id))
    .leftJoin(usedBy, eq(ticket.usedById, usedBy.id))
    .where(where)
    .orderBy(sql`${ticket.usedAt} desc nulls last`, asc(ticket.createdAt));
}

function scanLogFilters(input: ListScanLogsInput, withEmail: boolean): SQL[] {
  const filters: SQL[] = [];
  if (input.eventId) filters.push(eq(scanLog.eventId, input.eventId));
  if (input.result) filters.push(eq(scanLog.result, input.result));
  if (input.scannedById)
    filters.push(eq(scanLog.scannedById, input.scannedById));
  if (input.dateFrom) filters.push(gte(scanLog.createdAt, input.dateFrom));
  if (input.dateTo) filters.push(lte(scanLog.createdAt, input.dateTo));
  if (input.search) {
    const q = `%${input.search}%`;
    const match = or(
      ilike(ticket.holderName, q),
      ilike(buyer.name, q),
      withEmail ? ilike(buyer.email, q) : undefined,
      ilike(order.code, q),
      ilike(seat.label, q),
    );
    if (match) filters.push(match);
  }
  return filters;
}

function scanLogQuery(db: Db, where?: SQL) {
  return db
    .select({
      id: scanLog.id,
      createdAt: scanLog.createdAt,
      result: scanLog.result,
      eventId: scanLog.eventId,
      eventTitle: event.title,
      ticketId: scanLog.ticketId,
      holderName: ticket.holderName,
      buyerName: buyer.name,
      orderCode: order.code,
      tierName: ticketTier.name,
      seatLabel: seat.label,
      scannedById: scanLog.scannedById,
      scannedByName: scannedBy.name,
      device: scanLog.device,
      rawValue: scanLog.rawValue,
    })
    .from(scanLog)
    .leftJoin(event, eq(scanLog.eventId, event.id))
    .leftJoin(ticket, eq(scanLog.ticketId, ticket.id))
    .leftJoin(order, eq(ticket.orderId, order.id))
    .leftJoin(buyer, eq(order.userId, buyer.id))
    .leftJoin(ticketTier, eq(ticket.tierId, ticketTier.id))
    .leftJoin(seat, eq(ticket.seatId, seat.id))
    .leftJoin(scannedBy, eq(scanLog.scannedById, scannedBy.id))
    .where(where)
    .orderBy(desc(scanLog.createdAt));
}

/** Drop the raw value unless it's an unknown code (real ones are tokens). */
function toScanLogRow(
  r: Awaited<ReturnType<typeof scanLogQuery>>[number],
): ScanLogRow {
  const { rawValue, ...rest } = r;
  return {
    ...rest,
    rawValuePreview: r.result === "not_found" ? rawValue.slice(0, 40) : null,
  };
}

/** CSV timestamps in Manila time (`2026-10-23 19:05:12`), like the UI. */
const MANILA_CSV = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const csvTime = (d: Date | null) => (d ? MANILA_CSV.format(d) : "");

const RESULT_LABEL: Record<ScanResult, string> = {
  valid: "Valid",
  already_used: "Already used",
  wrong_event: "Wrong event",
  void: "Void",
  not_found: "Not found",
};

export const scanRouter = {
  /** Validate a scanned QR / manual code for the selected event. Always logged. */
  scan: permissionProcedure("tickets:scan")
    .input(scanTicketSchema)
    .mutation(async ({ ctx, input }): Promise<ScanResponse> => {
      return ctx.db.transaction(async (tx) => {
        // Lock the ticket row so two gates can't both mark it used.
        const [found] = await tx
          .select()
          .from(ticket)
          .where(eq(ticket.token, input.rawValue))
          .for("update");

        const writeLog = async (
          result: ScanResult,
          ticketId: string | null,
        ) => {
          await tx.insert(scanLog).values({
            ticketId,
            eventId: input.eventId,
            scannedById: ctx.user.id,
            rawValue: input.rawValue,
            result,
            device: input.device ?? null,
          });
        };

        if (!found) {
          await writeLog("not_found", null);
          return {
            result: "not_found",
            ticket: null,
            usedAt: null,
            usedByName: null,
          };
        }
        if (found.eventId !== input.eventId) {
          await writeLog("wrong_event", found.id);
          return {
            result: "wrong_event",
            ticket: withoutToken(found),
            usedAt: null,
            usedByName: null,
          };
        }
        if (found.status === "void") {
          await writeLog("void", found.id);
          return {
            result: "void",
            ticket: withoutToken(found),
            usedAt: null,
            usedByName: null,
          };
        }
        if (found.status === "used") {
          await writeLog("already_used", found.id);
          const usedBy = found.usedById
            ? await tx.query.user.findFirst({
                where: eq(user.id, found.usedById),
                columns: { name: true },
              })
            : null;
          return {
            result: "already_used",
            ticket: withoutToken(found),
            usedAt: found.usedAt,
            usedByName: usedBy?.name ?? null,
          };
        }

        // active + right event → mark used.
        const usedAt = new Date();
        const [updated] = await tx
          .update(ticket)
          .set({ status: "used", usedAt, usedById: ctx.user.id })
          .where(and(eq(ticket.id, found.id), eq(ticket.status, "active")))
          .returning();
        if (!updated) {
          // Lost the race — re-report as already used, with who/when.
          await writeLog("already_used", found.id);
          const fresh = await tx.query.ticket.findFirst({
            where: eq(ticket.id, found.id),
            columns: { usedAt: true, usedById: true },
          });
          const usedBy = fresh?.usedById
            ? await tx.query.user.findFirst({
                where: eq(user.id, fresh.usedById),
                columns: { name: true },
              })
            : null;
          return {
            result: "already_used",
            ticket: withoutToken(found),
            usedAt: fresh?.usedAt ?? found.usedAt,
            usedByName: usedBy?.name ?? null,
          };
        }
        await writeLog("valid", updated.id);
        return {
          result: "valid",
          ticket: withoutToken(updated),
          usedAt,
          usedByName: ctx.user.name,
        };
      });
    }),

  /**
   * Recent scans for the scanner screen. The raw scanned value is only
   * returned for unknown codes — for real tickets it IS the ticket token.
   */
  history: permissionProcedure("tickets:scan")
    .input(paginationSchema.extend({ eventId: idSchema }))
    .query(async ({ ctx, input }): Promise<Paginated<ScanHistoryRow>> => {
      const where = eq(scanLog.eventId, input.eventId);
      const offset = (input.page - 1) * input.pageSize;
      const [rows, [totalRow]] = await Promise.all([
        ctx.db
          .select()
          .from(scanLog)
          .where(where)
          .orderBy(desc(scanLog.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ value: count() }).from(scanLog).where(where),
      ]);
      return {
        items: rows.map(({ rawValue, ...rest }) => ({
          ...rest,
          rawValuePreview:
            rest.ticketId === null ? rawValue.slice(0, 40) : null,
        })),
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** Live check-in counter for an event. */
  checkInCount: permissionProcedure("tickets:scan")
    .input(z.object({ eventId: idSchema }))
    .query(
      async ({ ctx, input }): Promise<{ checkedIn: number; total: number }> => {
        const [[usedRow], [totalRow]] = await Promise.all([
          ctx.db
            .select({ value: count() })
            .from(ticket)
            .where(
              and(eq(ticket.eventId, input.eventId), eq(ticket.status, "used")),
            ),
          ctx.db
            .select({ value: count() })
            .from(ticket)
            .where(
              and(
                eq(ticket.eventId, input.eventId),
                // sold/active + used count toward the total; void does not.
                eq(ticket.status, "active"),
              ),
            ),
        ]);
        // total = active + used (non-void live tickets).
        const checkedIn = usedRow?.value ?? 0;
        const active = totalRow?.value ?? 0;
        return { checkedIn, total: active + checkedIn };
      },
    ),

  /** Events to pick from in the Scans module (everything except drafts). */
  eventOptions: permissionProcedure("tickets:scan").query(
    async ({ ctx }): Promise<ScanEventOption[]> => {
      return ctx.db
        .select({
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          status: event.status,
        })
        .from(event)
        .where(ne(event.status, "draft"))
        .orderBy(desc(event.startsAt));
    },
  ),

  /** Staff who have scanned (optionally for one event) — Scan log filter. */
  scannerOptions: permissionProcedure("tickets:scan")
    .input(z.object({ eventId: idSchema.optional() }))
    .query(async ({ ctx, input }): Promise<{ id: string; name: string }[]> => {
      return ctx.db
        .selectDistinct({ id: user.id, name: user.name })
        .from(scanLog)
        .innerJoin(user, eq(scanLog.scannedById, user.id))
        .where(input.eventId ? eq(scanLog.eventId, input.eventId) : undefined)
        .orderBy(asc(user.name));
    }),

  /** Check-ins tab: live tickets for an event with arrival state + counts. */
  checkins: permissionProcedure("tickets:scan")
    .input(listCheckinsSchema)
    .query(async ({ ctx, input }): Promise<CheckinsPage> => {
      const where = and(
        ...checkinFilters(input, canSeeEmails(ctx.permissions)),
      );
      const offset = (input.page - 1) * input.pageSize;
      const [items, [totalRow], [countsRow]] = await Promise.all([
        checkinQuery(ctx.db, where ?? sql`true`)
          .limit(input.pageSize)
          .offset(offset),
        ctx.db
          .select({ value: count() })
          .from(ticket)
          .innerJoin(order, eq(ticket.orderId, order.id))
          .leftJoin(buyer, eq(order.userId, buyer.id))
          .leftJoin(seat, eq(ticket.seatId, seat.id))
          .where(where),
        ctx.db
          .select({
            total: count(),
            checkedIn: count(ticket.usedAt),
          })
          .from(ticket)
          .where(
            and(eq(ticket.eventId, input.eventId), ne(ticket.status, "void")),
          ),
      ]);
      const withEmail = canSeeEmails(ctx.permissions);
      return {
        items: withEmail
          ? items
          : items.map((r) => ({ ...r, buyerEmail: null })),
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        checkedIn: countsRow?.checkedIn ?? 0,
        totalTickets: countsRow?.total ?? 0,
      };
    }),

  /** CSV of the filtered Check-ins list (ignores pagination). */
  exportCheckinsCsv: permissionProcedure("tickets:scan")
    .input(listCheckinsSchema)
    .query(async ({ ctx, input }): Promise<string> => {
      const where = and(
        ...checkinFilters(input, canSeeEmails(ctx.permissions)),
      );
      const rows = await checkinQuery(ctx.db, where ?? sql`true`).limit(10000);
      const withEmail = canSeeEmails(ctx.permissions);
      const header = [
        "Order",
        "Holder",
        "Buyer",
        ...(withEmail ? ["Buyer Email"] : []),
        "Ticket",
        "Checked In",
        "Checked In At (Manila)",
        "Checked In By",
      ];
      const body = rows.map((r) => [
        r.orderCode,
        r.holderName ?? r.buyerName ?? "",
        r.buyerName ?? "",
        ...(withEmail ? [r.buyerEmail ?? ""] : []),
        r.seatLabel ?? r.tierName ?? "",
        r.status === "used" ? "Yes" : "No",
        csvTime(r.usedAt),
        r.usedByName ?? "",
      ]);
      return toCsv([header, ...body]);
    }),

  /** Scan log tab: every scan attempt (incl. failures), filterable. */
  logs: permissionProcedure("tickets:scan")
    .input(listScanLogsSchema)
    .query(async ({ ctx, input }): Promise<Paginated<ScanLogRow>> => {
      const filters = scanLogFilters(input, canSeeEmails(ctx.permissions));
      const where = filters.length ? and(...filters) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [rows, [totalRow]] = await Promise.all([
        scanLogQuery(ctx.db, where).limit(input.pageSize).offset(offset),
        ctx.db
          .select({ value: count() })
          .from(scanLog)
          .leftJoin(ticket, eq(scanLog.ticketId, ticket.id))
          .leftJoin(order, eq(ticket.orderId, order.id))
          .leftJoin(buyer, eq(order.userId, buyer.id))
          .leftJoin(seat, eq(ticket.seatId, seat.id))
          .where(where),
      ]);
      return {
        items: rows.map(toScanLogRow),
        total: totalRow?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /** CSV of the filtered scan log (ignores pagination). */
  exportLogsCsv: permissionProcedure("tickets:scan")
    .input(listScanLogsSchema)
    .query(async ({ ctx, input }): Promise<string> => {
      const filters = scanLogFilters(input, canSeeEmails(ctx.permissions));
      const where = filters.length ? and(...filters) : undefined;
      const rows = (await scanLogQuery(ctx.db, where).limit(10000)).map(
        toScanLogRow,
      );
      const header = [
        "When (Manila)",
        "Result",
        "Event",
        "Order",
        "Holder",
        "Ticket",
        "Scanned By",
        "Device",
        "Unknown Code",
      ];
      const body = rows.map((r) => [
        csvTime(r.createdAt),
        RESULT_LABEL[r.result],
        r.eventTitle ?? "",
        r.orderCode ?? "",
        r.holderName ?? r.buyerName ?? "",
        r.seatLabel ?? r.tierName ?? "",
        r.scannedByName ?? "",
        r.device ?? "",
        r.rawValuePreview ?? "",
      ]);
      return toCsv([header, ...body]);
    }),
} satisfies TRPCRouterRecord;
