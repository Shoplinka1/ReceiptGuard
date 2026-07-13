---
name: Admin access fix
description: Root causes of /admin 500 error and the three-part fix applied.
---

# Admin Access Bugs

## Root causes (all three must be fixed together)

### 1. requireAdmin used `.single()` instead of `.maybeSingle()`
`single()` throws PGRST116 when the profile row doesn't exist, which surfaced as a 500 crash rather than a clean 403. Fixed to `.maybeSingle()` in admin.ts.

### 2. Paystack initialize used `.single()` for profile lookup
Same bug in `paystack.ts` — `.single()` on a missing profile row returned PGRST116, which the try/catch then re-threw as a 500 "Could not create user profile" error. Fixed to `.maybeSingle()`.

### 3. Profile rows missing for OAuth users
The `handle_new_user` trigger may not have been installed when the first users signed up via Google OAuth, leaving `auth.users` rows without matching `profiles` rows. Phase 7 migration backfills missing profile rows from `auth.users`.

**Why:** Supabase triggers must be explicitly applied to the live DB by running schema.sql in the SQL Editor. Users who signed up before the trigger was installed never got profile rows created.

## Phase 7 migration (supabase/phase7_migration.sql)
- Backfills profiles for auth users without a row
- Recreates `handle_new_user` trigger
- Adds FK constraints: `email_accounts.user_id → profiles(id)`, `payments.user_id → profiles(id)`, `subscriptions.user_id → profiles(id)`, `receipts.user_id → profiles(id)` for PostgREST join support
- Ensures `is_admin` and `is_suspended` columns exist
- Includes commented SQL to set `is_admin = true` for the admin user

## Admin queries: PostgREST embedded joins broke for payments/email_accounts
`payments.user_id` and `email_accounts.user_id` both FK to `auth.users(id)`, not `profiles(id)`. PostgREST cannot do `profiles(email, full_name)` embedded selects through an `auth.users` FK. Fixed by doing manual app-side joins (fetch payments/accounts, then separately fetch profiles by user_id and merge in app code).

**How to apply:** Any future admin query that needs profile data alongside payments or email_accounts must use manual join, not PostgREST embedded select syntax.

## is_admin must be set manually
The `is_admin` column defaults to `false`. The admin user must have it set via:
```sql
UPDATE public.profiles SET is_admin = true WHERE email = 'admin@example.com';
```
This is NOT done automatically by any trigger or migration (intentionally, to avoid accidental privilege escalation).
