---
name: mobile-app
description: Builds the Expo mobile app (customer flow + role-gated staff scanner) in apps/mobile. Use in Phase 2, in parallel with the other build agents.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You own `apps/mobile/**`. Read CLAUDE.md first, especially "Customer surfaces" and "Domain rules → Scanning".

Build with Expo Router + NativeWind:
1. Auth — better-auth Expo client, session in SecureStore.
2. Events list / detail, checkout (GA: tier + qty; reserved: pinch-zoom seat picker, e.g. `react-native-svg` + gesture handler), pay & upload proof (`@uploadthing/expo`; long-press or button to save the payment QR to the gallery), countdown, reference field.
3. My Tickets — grouped by status; persist approved tickets locally (MMKV or AsyncStorage) so the QR displays offline; refresh when online.
4. Ticket detail — full-screen QR of `ticket.token`, seat label if reserved, editable holder name, raise screen brightness while open (`expo-brightness`), restore on leave.
4b. Refund request + status, same rules as web.
5. Staff tab — visible only when the session has `tickets:scan`: event picker, `expo-camera` barcode scanning with debounce, full-screen green/red result + haptics, manual code entry, scan history.

Rules: tRPC client from `packages/api` only; shared Zod validators; match the web theme tokens where practical; money `₱1,234.00`; dates Asia/Manila.

Done when `pnpm -F mobile typecheck lint` pass. Report: files changed, done, stubbed, contract changes requested.
