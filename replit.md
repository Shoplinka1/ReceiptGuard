# ReceiptGuard

Automatic receipt, subscription, and warranty tracking that scans a user's Gmail and organizes their purchases. Previously deployed on Railway (API) + Vercel (frontend) + Supabase (DB); now running natively on Replit as a pnpm-workspace multi-artifact project.

## Run & Operate

Three artifacts run as separate workflows:
- `artifacts/receipt-guard` (web, `/`) — React + Vite customer-facing app
- `artifacts/api-server` (api, `/api`) — Express 5 API server (builds with esbuild, then runs the bundle)
- `artifacts/mockup-sandbox` (design, `/__mockup`) — component preview sandbox, not part of the product

Useful commands:
- `pnpm install` — install all workspace deps
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Data & auth

The app's actual data store is **Supabase** (Postgres + Auth), accessed via `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in `artifacts/api-server`. The `lib/db` Drizzle package and Replit's own Postgres (`DATABASE_URL`) are unused leftovers — do not wire new features to them without checking first.

Schema lives in `supabase/schema.sql` (base) and `supabase/migration.sql` (phased additions). Migrations must be run manually in the Supabase SQL Editor — nothing applies them automatically.

## Required secrets (Replit Secrets)

- `SUPABASE_SERVICE_ROLE_KEY` — critical; without it every DB-backed route 503s
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Gmail OAuth
- `ENCRYPTION_KEY` — 64-char hex (32 bytes), encrypts stored Gmail tokens; changing it breaks existing Gmail connections
- `PAYSTACK_SECRET_KEY` — billing/subscriptions
- Email sending (`EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM`) is not yet configured on this Replit instance — see follow-up tasks

## Shared env vars

`SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `FRONTEND_URL`, `GOOGLE_REDIRECT_URI` are set in Replit env vars. `FRONTEND_URL`/`GOOGLE_REDIRECT_URI` must match the current Replit dev domain (`$REPLIT_DEV_DOMAIN`) — update them if the domain ever changes, and keep the corresponding redirect URI allowlisted in Google Cloud Console.

## Gotchas

- This is treated as a live product with real users/data (see `attached_assets/Pasted-ReceiptGuard-Production-Continuation-Prompt...txt` for the standing engineering rules) — avoid rewriting Gmail scanning, OAuth, parsing, billing, or auth unless a bug is confirmed; keep changes small and explain production-impacting ones before making them.
- `DEPLOY.md` documents the old Railway/Vercel deployment checklist; useful background but no longer the deploy path now that this runs on Replit.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
