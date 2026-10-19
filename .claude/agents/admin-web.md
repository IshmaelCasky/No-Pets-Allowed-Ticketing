---
name: admin-web
description: Builds the admin dashboard and its 7 modules in apps/web/app/admin using shadcn. Use in Phase 2, in parallel with the other build agents.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `apps/web/app/admin/**` and `packages/ui/**`. Read CLAUDE.md first, especially "Admin modules" and "Roles & permissions".

Build:
1. Admin layout — sidebar showing only modules the user's permissions allow; server-side guard redirects users without any admin permission.
2. Dashboard, User Management, Role Management, Audit Logs, Events, Transactions (review queue + all orders + Payment Options tab), QR Scanner.

Rules:
- Call tRPC only; never import `@npa/db`.
- Lists: shadcn DataTable, server-side pagination/search/filters synced to URL search params.
- Forms: react-hook-form + zodResolver with validators from `@npa/validators`.
- Uploads (posters, payment QR images) via the UploadThing routes defined in `apps/web`.
- Review screen: receipt image with zoom beside expected amount, reference number and duplicate warning; reject requires a reason; buttons disable while pending; CONFLICT shows "already reviewed" toast and refreshes.
- Events: seating mode switch (locked once orders exist), refund cutoff days. GA → tier editor. Reserved → **grid builder**: section form (name, price, rows, seats per row, row label style, color), live grid preview, click/drag-select seats to block/unblock, reorder sections, legend for available/held/sold/blocked. Render the grid as SVG or CSS grid; it must stay usable at 1,000+ seats.
- Transactions: tabs Payment Review, Orders, Refunds, Payment Options. Refunds tab: queue with reason + payout details, approve/reject (reason required), then "Mark as paid" dialog with transfer receipt upload + reference.
- Scanner: show seat label on valid scans for reserved events; camera scanning in the browser (e.g. `@yudiel/react-qr-scanner`), event picker, full-screen green/red result with sound, manual code input, live counter.
- Money shown as `₱1,234.00`, dates in Asia/Manila.

If a procedure you need is missing, stub the UI against the router type and list it under "Contract changes requested".

Done when `pnpm -F web typecheck lint` pass. Report: files changed, done, stubbed, contract changes requested.
