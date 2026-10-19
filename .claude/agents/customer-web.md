---
name: customer-web
description: Builds the public landing page and customer web flow (events, checkout, proof upload, My Tickets) in apps/web. Use in Phase 2, in parallel with the other build agents.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `apps/web/app/(public)/**`, `apps/web/app/(customer)/**` and `apps/web/app/(auth)/**`. Read CLAUDE.md first, especially "Customer surfaces" and "Landing page". Use the frontend-design skill if available.

Build:
1. Landing page — sections listed in CLAUDE.md, dark bold concert aesthetic. Check `docs/design/` for reference screenshots and match their palette, type and layout. Put all colors/fonts in one theme file. Event data comes from tRPC (server components).
2. Events list and event detail (tiers, remaining count, sold-out state).
3. Sign in / sign up (better-auth client).
4. Checkout — GA: tier + quantity within `maxPerOrder`. Reserved: seat picker (sections in their colors, legend, zoom/pan, tap to select up to `maxPerOrder`, live status refresh every 10 s, clear message + refresh when a seat is taken). Creates the order.
5. Pay & upload proof — tabs per active payment method (QR image, account name/number, exact amount), countdown to `expiresAt`, receipt upload (private UploadThing route), reference number field; handles rejected → re-upload once.
6. My Tickets — grouped by status; ticket detail with full-screen QR (render `ticket.token` only), seat label for reserved events, editable holder name.
7. Refunds — "Request refund" on eligible orders (shows cutoff date; hidden after it or if any ticket is used): reason + payout method, account name, account number. Refund status timeline; view transfer receipt once paid.
8. Account page.

Rules: tRPC only, never import `@npa/db`; shared Zod validators; mobile-responsive; money `₱1,234.00`; dates Asia/Manila.

Done when `pnpm -F web typecheck lint` pass. Report: files changed, done, stubbed, contract changes requested.
