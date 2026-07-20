---
name: receipt-guard admin removal
description: What was removed from the customer app when the admin app was separated
---

## Rule
The customer app (`artifacts/receipt-guard`) must NOT expose admin functionality.

**Why:** User explicitly required complete separation.

## What was removed
- `const AdminPage = lazy(() => import('./pages/admin'))` import from `App.tsx`
- `/admin` route from `App.tsx` `Switch`
- Admin nav link (`{isAdmin && <Link href="/admin">…</Link>}`) from `app-shell.tsx`
- `ShieldAlert` import from `app-shell.tsx` (was only used for admin nav)

## What was left in place
- `artifacts/receipt-guard/src/pages/admin.tsx` — file retained but unreachable from router
- `is_admin` profile fetch in `AppShell` and `ProtectedRoute` — still used for other admin-check purposes

## TS fixes applied at the same time
- `queryKey: ['/api/user/profile']` added to `useGetUserProfile` call in `protected-route.tsx` and `app-shell.tsx` — the generated hook requires an explicit `queryKey` in the `query` option (not optional in the compiled `.d.ts`).
