---
name: Warranties reminder_enabled/is_estimated columns
description: A code/schema drift bug that made manual warranty creation fail, plus the category-based warranty estimation fix
---

`artifacts/api-server/src/routes/warranties.ts` inserted/updated a
`reminder_enabled` column on the `warranties` table that was never defined in
`supabase/schema.sql`. Every manual "Add Warranty" POST/PATCH failed with a
Postgres "column does not exist" error, so warranty rows were never created —
one of the root causes behind the Warranties dashboard always showing 0.

**Why:** schema.sql and the route code drifted apart over time with no
migration or type-check catching it (Supabase client calls aren't statically
typed against the live schema).

**How to apply:** when a route references a new column, always add it to both
`supabase/schema.sql` (fresh installs) and `supabase/migration.sql` (existing
DBs) in the same change — grep the schema before assuming a column exists.

Separately, the other root cause was that warranty auto-detection only fired
on an explicit "N year/month warranty" phrase in the email body, which almost
no order-confirmation email contains. Fixed by adding category-based
estimation (`isWarrantyEligible`/`estimateWarrantyMonths` in gmail.ts): for
"shopping"-category purchases from merchants not in `NO_WARRANTY_MERCHANTS`
(subscriptions/services/digital goods), a default 12-month estimate is
created with `is_estimated: true`. The API and UI must always surface
`isEstimated` and label these "Estimated" — never present a guess as a
confirmed manufacturer warranty. Editing a warranty's length/expiry via PATCH
clears `is_estimated`.
