# No Pets Allowed — Concert Ticketing

Ticketing platform for **No Pets Allowed** concerts. Customers pay manually via a
posted QR code (GCash/Maya/bank), upload a receipt, and staff approve it;
approved orders produce scannable QR tickets. See [`CLAUDE.md`](./CLAUDE.md) for
the full spec, domain rules, and build orchestration.

## Stack

Turborepo + pnpm (scaffolded from `create-t3-turbo`): Next.js (web), Expo
(mobile), tRPC (`@npa/api`), Drizzle + PostgreSQL/Neon (`@npa/db`), better-auth
(`@npa/auth`), Zod (`@npa/validators`), UploadThing, Resend.

```
apps/web      apps/mobile
packages/db   packages/auth   packages/api   packages/validators   packages/ui
tooling/*
```

## Getting started

```bash
pnpm i
cp .env.example .env         # then fill in real values (see below)

pnpm db:generate             # generate Drizzle migration SQL
pnpm db:migrate              # apply migrations to the database
pnpm db:seed                 # roles, Super Admin, default payment methods

pnpm dev                     # run all apps
pnpm -F @npa/web dev         # web only
pnpm -F @npa/mobile dev      # mobile only

pnpm typecheck && pnpm lint  # run before declaring any task done
```

### Environment

Copy `.env.example` to `.env` and set:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (Neon) connection string |
| `BETTER_AUTH_SECRET` | better-auth signing secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | App base URL (e.g. `http://localhost:3000`) |
| `UPLOADTHING_TOKEN` | UploadThing API token (payment/refund proofs) |
| `RESEND_API_KEY` | Resend API key (transactional email) |
| `CRON_SECRET` | Secret for the order-expiry cron route |

`db:migrate` / `db:seed` require a live `DATABASE_URL`.
