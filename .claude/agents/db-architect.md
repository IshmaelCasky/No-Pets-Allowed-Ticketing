---
name: db-architect
description: Designs and writes the Drizzle schema, enums, constraints, migrations and seed in packages/db. Use in Phase 1 before any other build agent runs.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `packages/db` only. Read CLAUDE.md first.

Build exactly the schema in CLAUDE.md → "Database schema" and "Roles & permissions":
- Postgres enums for every status (order, ticket, event, seat, refund request, scan result) and `seating_mode`.
- Seating: `seat_section` + `seat` tables; unique `(section_id, row_label, number)`; index `(event_id, status)` on `seat`.
- CHECK on `order_item` and `ticket`: exactly one of `tier_id` / `seat_id` is set.
- Partial unique indexes: `ticket.seat_id` where status ≠ `void`; `refund_request.order_id` where status in (`requested`, `approved`).
- `event.refund_cutoff_days` default 7, `event.max_per_order` default 4.
- cuid2 text IDs, `timestamptz`, money as integer centavos.
- Index every FK and every admin filter column.
- Unique: `(payment_method_id, reference_number)`, `ticket.token`, `order.code`, `event.slug`, `role.name`.
- CHECK `reserved + sold <= capacity` and `reserved >= 0`, `sold >= 0` on `ticket_tier`.
- Extend the better-auth `user` table (generate with `@better-auth/cli generate` first, then add columns).
- Drizzle `relations()` for every FK.
- Export inferred types (`$inferSelect`, `$inferInsert`) and a `PERMISSIONS` const array of all permission keys.
- Seed (idempotent): 5 roles with their permission keys, one Super Admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, GCash + Maya payment methods (inactive, no QR).

Generate and run migrations against the local `DATABASE_URL`.

Done when `pnpm -F @npa/db typecheck` passes. Report: table list, enums, any deviation from CLAUDE.md and why.
