# No Pets Allowed — Concert Ticketing System

Ticketing platform for **No Pets Allowed** concerts. Customers pay manually via a posted QR code (GCash/Maya/bank), upload a receipt image + reference number, and staff approve it. Approved orders produce QR tickets that are scanned at the gate. Each event is either **general admission (tiers)** or **reserved seating (seat map)**, chosen per event by the admin. Customers can request refunds in-app.

Read this whole file before writing code. Follow the **Orchestration** section for how work is split across subagents.

---

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | Turborepo + pnpm workspaces (scaffold from `create-t3-turbo`; it already wires Next.js + Expo + tRPC + Drizzle + better-auth) |
| Web | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| Mobile | Expo (React Native) + Expo Router + NativeWind |
| API | tRPC in `packages/api`, served by a Next.js route handler, consumed by web and mobile |
| DB | PostgreSQL + Drizzle ORM / drizzle-kit |
| Auth | better-auth (+ `@better-auth/expo` on mobile) |
| Uploads | UploadThing (`@uploadthing/react`, `@uploadthing/expo`) |
| Validation | Zod (shared in `packages/validators`) |
| Email | Resend (approval / rejection emails) |

## Repo layout

```
apps/
  web/          # landing, customer portal (/events, /my-tickets), admin (/admin/*), API + UploadThing route handlers
  mobile/       # customer app + staff scanner mode (role-gated)
packages/
  db/           # Drizzle schema, migrations, seed
  auth/         # better-auth server config + web/expo clients
  api/          # tRPC routers, permission middleware, audit helper, business logic
  validators/   # Zod schemas shared by forms and API input
  ui/           # shadcn components for web
tooling/        # tsconfig, eslint, prettier, tailwind presets
```

## Commands

```
pnpm i
pnpm dev                 # all apps
pnpm -F web dev
pnpm -F mobile dev
pnpm db:generate         # drizzle-kit generate
pnpm db:migrate
pnpm db:seed             # roles, Super Admin, default payment methods
pnpm typecheck && pnpm lint && pnpm test
```

Run `pnpm typecheck && pnpm lint` before declaring any task done.

---

## Domain rules (non-negotiable)

### Order lifecycle
`pending_payment` → `for_review` → `approved` | `rejected` | `expired` | `cancelled`; `approved` → `refunded`

- Creating an order **reserves** seats immediately and sets `expiresAt` (payment window).
- Customer uploads receipt + reference → `for_review`.
- Staff approve → `approved`, seats move `reserved` → `sold`, one `ticket` per seat is generated, email sent.
- Staff reject (reason required) → `rejected`; customer may re-upload **once** before `expiresAt` (→ `for_review`).
- Window passes with no valid proof → `expired`, reserved seats released (cron every 5 min).

- Approved order with an approved refund → `refunded` (see Refunds).

### Ticket lifecycle
`active` → `used`, or `void`. First valid scan marks `used` with `usedAt` + `usedById`.

### Seating modes (per event, `event.seatingMode`)
- **`ga`** — buyer picks tier + quantity. Inventory is counted on `ticket_tier`.
- **`reserved`** — admin builds a seat map with the **grid builder**: sections (e.g. VIP, Lower Box), each a grid of `rows × seatsPerRow`, priced per section; individual seats can be blocked (pillars, production, comps). Buyer picks exact seats on a seat picker. Each ticket is tied to one `seat`.
- Seating mode can't change once any order exists for the event.

### Inventory
- **GA:** create-order runs in one transaction: `SELECT … FOR UPDATE` on the tier row, check `capacity - reserved - sold >= qty`, increment `reserved`. DB CHECK `reserved + sold <= capacity` as backstop.
- **Reserved:** create-order runs in one transaction: `SELECT … FOR UPDATE` on the chosen `seat` rows, all must be `available`, set them to `held` with `heldByOrderId`. Approve → `sold`. Reject (final) / expire / cancel / refund → back to `available`. A unique index on `ticket.seatId` (where status ≠ void) makes double-selling impossible.
- Seat map status refreshes live on the picker (poll every 10 s or on focus); a seat taken mid-checkout returns `CONFLICT` with the taken seat IDs.

### Refunds
- Customer requests a refund on an `approved` order until `event.startsAt − event.refundCutoffDays` days. Request = reason + payout details (method label, account name, account number). One open request per order.
- `refund_request.status`: `requested` → `approved` | `rejected` → (`approved` only) `paid`.
- Staff approve → tickets `void` immediately, seats/tier quantity released, order stays `approved` until paid. Staff reject → reason required, tickets untouched.
- Staff send the money manually, upload the transfer receipt + reference → `paid`, order → `refunded`.
- Used tickets block a refund request. Email sent on every refund status change.

### Concurrency
Approve/reject is a conditional update `WHERE status = 'for_review'`. Zero rows updated → throw `CONFLICT` ("already reviewed").

### Money
Store as integer centavos. Format as `₱1,234.00` only at the UI layer.

### QR tickets
QR encodes only `ticket.token` (random 128-bit, base64url, unique). Never encode IDs or order codes.

### Scanning
Scanner selects an event. Each scan → write a `scan_log` row (always, including failures) with result:
`valid` | `already_used` | `wrong_event` | `void` | `not_found`. `already_used` responses include when and by whom.

### Payment and refund proofs
Private UploadThing routes (`paymentProof`, `refundProof`), images only (jpg/png/webp), max 4 MB. Viewed via signed URLs: admins see all, customers see only their own. Unique index on `(paymentMethodId, referenceNumber)`; review screen flags duplicates.

### Notifications
Email only (Resend): order approved (link to tickets), order rejected (reason), order expired, refund approved / rejected / paid. Templates with React Email in `packages/api/src/emails`.

---

## Database schema (`packages/db`)

better-auth tables: `user`, `session`, `account`, `verification` (generate with `@better-auth/cli generate`, then add columns below to `user`).

| Table | Columns |
| --- | --- |
| `user` (+ext) | phone, roleId → role, banned, banReason |
| `role` | id, name (unique), description, permissions `text[]`, isSystem |
| `event` | id, slug (unique), title, lineup, venue, startsAt, doorsOpenAt, posterUrl, description, status (`draft`/`published`/`ended`/`cancelled`), seatingMode (`ga`/`reserved`), maxPerOrder, refundCutoffDays |
| `ticket_tier` | id, eventId, name, price, capacity, reserved, sold, salesStartAt, salesEndAt, sortOrder (GA events) |
| `seat_section` | id, eventId, name, price, rows, seatsPerRow, rowLabelStyle (`alpha`/`numeric`), color, sortOrder (reserved events) |
| `seat` | id, sectionId, eventId, rowLabel, number, label (e.g. `VIP-B12`), status (`available`/`held`/`sold`/`blocked`), heldByOrderId; unique (sectionId, rowLabel, number) |
| `payment_method` | id, label, accountName, accountNumber, qrImageUrl, instructions, isActive, sortOrder |
| `order` | id, code (`NPA-XXXXX`, unique), userId, eventId, status, totalAmount, paymentMethodId, referenceNumber, proofImageKey, submittedAt, reviewedById, reviewedAt, rejectionReason, resubmitCount, expiresAt, createdAt |
| `order_item` | id, orderId, tierId (nullable), seatId (nullable), quantity, unitPrice — exactly one of tierId/seatId set (CHECK) |
| `ticket` | id, orderId, eventId, tierId (nullable), seatId (nullable), holderName, token (unique), status, usedAt, usedById, createdAt; partial unique on seatId where status ≠ `void` |
| `refund_request` | id, orderId, userId, reason, payoutMethod, payoutAccountName, payoutAccountNumber, status, reviewedById, reviewedAt, rejectionReason, payoutReference, payoutProofKey, paidAt, createdAt; partial unique on orderId where status in (`requested`,`approved`) |
| `scan_log` | id, ticketId (nullable), eventId, scannedById, rawValue, result, device, createdAt |
| `audit_log` | id, actorId, action, entityType, entityId, before `jsonb`, after `jsonb`, ip, userAgent, createdAt |

IDs: `text` cuid2. Timestamps: `timestamp with time zone`. Use Postgres enums for statuses. Index every FK and every column used in admin filters.

---

## Roles & permissions

Permissions are `resource:action` keys stored on `role.permissions`. **Code checks permission keys, never role names.**

Keys: `events:read`, `events:write`, `events:delete`, `orders:read`, `orders:review`, `refunds:review`, `payment_methods:write`, `tickets:scan`, `tickets:void`, `users:read`, `users:write`, `users:ban`, `roles:write`, `audit:read`.

Seeded roles: **Super Admin** (all, `isSystem`, undeletable; last one can't be demoted), **Admin** (all except `roles:write`), **Staff** (`orders:read`, `orders:review`, `refunds:review`, `tickets:scan`), **Scanner** (`tickets:scan`), **Customer** (none, `isSystem`, default for sign-ups).

tRPC procedures: `publicProcedure`, `protectedProcedure`, and `permissionProcedure('orders:review')`. Users can never edit their own role.

## Audit logging

Every admin mutation calls `audit(ctx, { action, entityType, entityId, before, after })` from `packages/api/src/audit.ts` inside the same transaction. Actions use `entity.verb` (e.g. `order.approve`, `payment_method.update`, `role.update`, `user.ban`, `ticket.void`). Audit logs are append-only — no update/delete procedures.

---

## Admin modules (`apps/web/app/admin`)

All list screens: shadcn DataTable with server-side pagination, search, filters.

1. **Dashboard** — tickets sold per event, pending review count, approved revenue, check-ins today.
2. **User Management** — list/search/filter by role, create staff, assign role, ban/unban, reset password, view user's orders/tickets.
3. **Role Management** — CRUD roles, grouped permission checklist, member count, system roles locked.
4. **Audit Logs** — filter by actor/action/entity/date, before/after JSON diff, CSV export.
5. **Events** — CRUD, poster upload, publish/unpublish, seating mode (GA / reserved), refund cutoff days, attendee CSV export.
   - GA: ticket tiers (price, capacity, sales window), live sold/reserved/remaining.
   - Reserved: **grid builder** — add sections (name, price, rows, seats per row, row label style, color), preview the grid, click seats to block/unblock, drag sections to reorder; live map of available/held/sold/blocked.
6. **Transactions** — tabs:
   - **Payment Review** — queue oldest first, receipt zoom beside expected amount + reference, duplicate flag, approve/reject.
   - **Orders** — search all orders by code/reference/buyer, cancel order with note.
   - **Refunds** — request queue (reason, order, payout details), approve/reject, then mark paid with transfer receipt + reference.
   - **Payment Options** — add/edit/reorder methods, upload/replace QR image, toggle active.
7. **QR Scanner** — event picker, camera scan, full-screen green/red result + sound, manual code entry, live check-in counter, scan history.

## Customer surfaces

| Screen | Web | Mobile |
| --- | --- | --- |
| Landing | ✓ | — |
| Events list / detail | ✓ | ✓ |
| Sign in / sign up | ✓ | ✓ |
| Checkout — GA: tier + qty; Reserved: seat picker (sections, legend, zoom/pan, max `maxPerOrder` seats) | ✓ | ✓ |
| Pay & upload proof (QR per method, amount, countdown, receipt upload, reference field) | ✓ | ✓ |
| My Tickets (grouped by status) | ✓ | ✓ (cache approved tickets for offline display) |
| Ticket detail (full-screen QR, seat label if reserved, editable holder name) | ✓ | ✓ (brightness boost) |
| Request refund (reason + payout account) and refund status | ✓ | ✓ |
| Account | ✓ | ✓ |
| Staff scanner | `/admin/scanner` | role-gated tab (`tickets:scan`) |

## Landing page

Dark, bold concert aesthetic. Sections: nav → hero (next show, CTA) → upcoming shows cards → featured show countdown + tier cards → How to buy (Pay via QR → Upload receipt → Get QR ticket) → about/gallery → FAQ → footer. Pull live data from `event`. "How to buy" and FAQ must mention the 30-minute payment window and the refund cutoff. Reference designs: `docs/design/` (screenshots of the Dribbble shots — Tiketin landing page and Musician Concerts website). If that folder is empty, build the structure and leave styling tokens in one theme file.

---

## Confirmed decisions (client-approved — don't change without asking)

| Topic | Decision |
| --- | --- |
| Mobile | Expo app for customers + role-gated staff scanner |
| Payment window | 30 minutes from order creation (seats/tiers held during it) |
| Max tickets per order | `event.maxPerOrder`, default 4 |
| Holder name per ticket | Optional; defaults to buyer name, editable per ticket |
| Guest checkout | No — account required |
| Seating | Per event: GA tiers **or** reserved seats via grid builder |
| Offline scanning | No — scanner is online only |
| Refunds | In-app requests until `refundCutoffDays` before the event (set per event, default 7); manual payout with transfer receipt as proof |
| Notifications | Email only (Resend) |
| Hosting | Vercel (web + cron) + Neon (Postgres) + EAS (mobile builds) |

Still needed from the client (not blocking the build): No Pets Allowed logo and brand colors, Dribbble reference screenshots in `docs/design/`, launch payment methods and their QR images, Resend sender domain.

---

## Orchestration (multi-agent build)

The lead agent (main session) owns planning, shared contracts, and integration. Specialized subagents in `.claude/agents/` do parallel work. **Shared contracts must be frozen before fan-out**, otherwise agents collide.

### Phase 1 — Foundation (lead, sequential, do NOT parallelize)
1. Scaffold monorepo from `create-t3-turbo`, rename packages to `@npa/*`, add UploadThing.
2. `db-architect`: full schema, enums, constraints, migrations, seed.
3. Lead: `packages/auth` (better-auth + roles), `packages/validators` (all Zod schemas), `packages/api` skeleton — routers stubbed with typed inputs/outputs, `permissionProcedure`, `audit()` helper.
4. Commit. These files are now **contracts**: after this point only the lead edits `packages/db/schema`, `packages/validators`, and router signatures.

### Phase 2 — Fan-out (run these subagents in parallel, each in its own worktree)

| Subagent | Owns (may edit) | Delivers |
| --- | --- | --- |
| `api-builder` | `packages/api/src/routers/**` (bodies only), `packages/api/src/emails/**` | order, review, refund, seat map, ticket, scan, event, payment method, user, role, audit procedures + emails + tests |
| `admin-web` | `apps/web/app/admin/**`, `packages/ui/**` | all 7 admin modules |
| `customer-web` | `apps/web/app/(public)/**`, `apps/web/app/(customer)/**`, `apps/web/app/(auth)/**` | landing, events, checkout, upload proof, My Tickets |
| `mobile-app` | `apps/mobile/**` | customer app + scanner mode |

Rules for every subagent:
- Edit only the paths you own. Need a contract change (schema, validator, router signature)? **Stop and report it** to the lead instead of editing.
- UI agents code against the stubbed router types; mock with the tRPC types if `api-builder` isn't done yet.
- Finish with `pnpm typecheck && pnpm lint` passing for your workspace, then report: files changed, what's done, what's stubbed, contract changes requested.

### Phase 3 — Integration & review (lead)
1. Merge worktrees in order: `api-builder` → `admin-web` → `customer-web` → `mobile-app`.
2. Apply any requested contract changes, re-run typecheck.
3. Run `reviewer` subagent (fresh context) against the Domain rules section; fix findings.
4. Smoke-test both seating modes: seed → create GA event and reserved event (grid builder) → buy (tiers / pick seats) → upload proof → approve → ticket shows → scan valid → scan again shows already used. Then: request refund → approve (tickets void, seats free again) → mark paid with proof → order `refunded`.

---

## Conventions

- TypeScript strict. No `any`. Infer types from Drizzle/Zod, don't hand-write duplicates.
- Server components by default on web; client components only for interactivity.
- Forms: react-hook-form + zodResolver with the shared validator.
- All business logic lives in `packages/api`. UI never talks to the DB directly.
- Dates stored UTC, displayed in `Asia/Manila`.
- Errors: tRPC `TRPCError` with codes (`FORBIDDEN`, `CONFLICT`, `BAD_REQUEST`); UI shows them via toast.
- Never commit `.env`. Keep `.env.example` updated: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `UPLOADTHING_TOKEN`, `RESEND_API_KEY`, `CRON_SECRET`.
