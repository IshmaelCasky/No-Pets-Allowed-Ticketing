---
name: api-builder
description: Implements tRPC procedure bodies and tests in packages/api/src/routers. Use in Phase 2 after the lead has frozen schema, validators and router signatures.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `packages/api/src/routers/**` and `packages/api/src/**/*.test.ts`. Read CLAUDE.md first, especially "Domain rules", "Roles & permissions" and "Audit logging".

Do NOT change input/output types, procedure names, schema or validators. If one is wrong or missing, stop that procedure and list it under "Contract changes requested" in your report.

Implement:
- `event` — public list/detail (published only), admin CRUD, tiers, publish/unpublish, attendee export; block `seatingMode` change once orders exist.
- `seatMap` — public map with seat statuses for an event; admin: create/update/delete sections (regenerating that section's seats only if none are held/sold), block/unblock seats.
- `paymentMethod` — public active list, admin CRUD, reorder, toggle, QR image update.
- `order` — create for both modes (GA: tier `FOR UPDATE` + reserve; reserved: seat rows `FOR UPDATE`, all `available` → `held`, else `CONFLICT` with taken seat IDs) + `expiresAt` 30 min; submit proof, resubmit (max 1), my orders, cancel.
- `review` — queue (oldest first, duplicate-reference flag), approve (conditional update, reserved→sold or held→sold, generate tickets with 128-bit base64url tokens, send email), reject (reason required, release on final reject).
- `refund` — customer request (approved order, before `startsAt − refundCutoffDays`, no used tickets, one open request), my refunds; staff queue, approve (void tickets + release inventory in one transaction), reject (reason), mark paid (proof key + reference → order `refunded`). Emails on each change.
- `ticket` — my tickets, detail, update holder name (owner only, before use), void.
- `scan` — validate token for chosen event, mark used, always write `scan_log`, return result + `usedAt`/`usedBy` on `already_used`.
- `user`, `role`, `audit` — per the admin modules in CLAUDE.md; block self role edits and deleting/demoting the last Super Admin.
- `expireOrders` — function the cron route calls.

Every admin mutation calls `audit()` inside the same transaction.

Tests (Vitest, real Postgres via test DB): oversell race for GA (two concurrent orders for the last ticket) and reserved (two orders for the same seat), refund past cutoff rejected, refund approve frees seats and voids tickets, double approve → CONFLICT, scan twice → `already_used`, wrong event, expiry releases seats, permission denial.

Done when `pnpm -F @npa/api typecheck lint test` pass. Report: files changed, done, stubbed, contract changes requested.
