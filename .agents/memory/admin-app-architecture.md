---
name: Admin app architecture
description: How the separate admin app (artifacts/admin-app) is structured and connects to the API
---

## Rule
The admin app is a completely separate React/Vite artifact (`artifacts/admin-app`, previewPath `/admin`).
It has its own Supabase auth, its own `use-auth.tsx` hook, its own login page, and its own `ProtectedAdminRoute`.

**Why:** The user explicitly required admin code not be exposed inside the customer application.

## How it works
- **Auth:** `hooks/use-auth.tsx` calls `supabase.auth.signInWithPassword` then fetches `/api/user/profile` to check `isAdmin`. No `@workspace/api-client-react` dependency — uses direct `apiFetch` with bearer token.
- **Route guard:** `ProtectedAdminRoute` shows spinner while `isAdmin === null`, redirects to `/login` if no user, shows "Access Denied" screen if `isAdmin === false`.
- **API calls:** `apiFetch` in `admin-dashboard.tsx` dynamically imports `@/lib/supabase` to get the session token and calls the existing `/api/admin/*` endpoints — no backend changes needed.
- **VITE_API_URL:** Set to `""` via `vite.config.ts` `define` — all `/api/...` calls are same-origin relative, matching the receipt-guard pattern for Vercel rewrites.

## How to apply
- If adding new admin pages, create them under `artifacts/admin-app/src/pages/` and add routes in `App.tsx`.
- Never add admin routes to `artifacts/receipt-guard` — that was explicitly removed.
- The `/api/admin/*` routes on the API server already enforce `requireAuth + requireAdmin` server-side, so the client-side guard is UX-only.

## Production deployment (admin.getreceiptguard.xyz)
Requires a separate Vercel project pointing at the `artifacts/admin-app/dist/public` build output, with a `vercel.json` rewrite proxying `/api/*` to the Railway API server. DNS CNAME `admin.getreceiptguard.xyz` → Vercel deployment domain. **This is user-side work; not done from Replit.**
