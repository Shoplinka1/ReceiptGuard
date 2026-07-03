# ReceiptGuard

A premium SaaS that automatically organizes Gmail receipts, detects subscriptions, tracks warranties, and alerts on renewals. Feels like Stripe, Linear, and Vercel — for personal finances.

## Run & Operate

- `pnpm --filter @workspace/receipt-guard run dev` — run the frontend (auto-assigned port)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (pre-configured)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter routing, TanStack Query, Tailwind CSS v4, shadcn/ui, Recharts, Framer Motion
- API: Express 5, Pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)

## Where things live

- `artifacts/receipt-guard/src/` — React frontend (pages, components, hooks)
- `artifacts/api-server/src/routes/` — Express route handlers (dashboard, receipts, subscriptions, warranties, renewals, user, merchants)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle ORM table definitions (users, receipts, subscriptions, warranties, merchants, settings)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/` — Generated Zod validation schemas (do not edit manually)

## Architecture decisions

- **OpenAPI-first**: All backend contracts defined in `lib/api-spec/openapi.yaml` before implementation. Codegen produces both frontend hooks and backend Zod validators.
- **Single demo user (id=1)**: App ships with a seeded demo user and data. Multi-user auth would add JWT/session middleware and per-request userId extraction.
- **Renewals as derived views**: Renewals are computed from active subscriptions rather than a separate table — simplifies data model and keeps renewal dates in sync with subscriptions.
- **Gmail scan is mocked**: `POST /api/gmail/scan` marks the user as connected and logs activity; real Gmail OAuth + API integration is architecture-ready (modular routes).
- **AI-ready structure**: Routes are modular and data models include metadata fields to support future AI receipt summarization and spending insights without refactoring.

## Product

ReceiptGuard helps users:
- Track all receipts automatically from Gmail (or manually)
- Monitor active subscriptions with billing cycle and renewal date visibility
- Get ahead of upcoming renewals (next 30 days dashboard + calendar view)
- Track product warranties and get expiry alerts
- See spending trends, top merchants, and category breakdowns

### Plans
- **Free**: 1 Gmail account, 50 receipts, 5 active subscriptions, basic dashboard
- **Pro ($5.99/mo or $49/yr)**: Unlimited everything, warranty tracking, CSV/PDF export, AI features (coming soon)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before touching any frontend or backend code.
- Do not run `pnpm dev` at workspace root — use individual workflow restarts.
- The `subscriptions/breakdown` route must be registered before `subscriptions/:id` in Express to avoid the `:id` param capturing "breakdown" as an ID.
- Receipts `amount` is stored as `numeric` in Postgres — always `parseFloat()` when returning to API response.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
