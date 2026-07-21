---
name: Reminder scheduler settings select must degrade gracefully on missing columns
description: A single missing column in the settings SELECT can silently disable ALL reminder toggles, not just the new one, until the migration is applied.
---

`reminder-scheduler.ts` selects several `days_before_N` boolean columns from `settings` in one query. If a newly-added column referenced in that SELECT (e.g. `days_before_90`, `days_before_60`) doesn't exist yet on a given environment's DB (migration not yet run), PostgREST returns an error for the WHOLE select — `settings` comes back `undefined`, silently bypassing every toggle in that row (not just the new ones), including `warranty_reminder`/`email_notifications`.

**Why:** A partial-column SELECT is atomic — you can't get "the columns that exist" back gracefully by default.

**How to apply:** When adding a new column to a reminder/notification settings SELECT, catch the select error and retry with the pre-migration column set as a fallback, so old toggles keep working even if the new migration hasn't been applied yet in a given environment. Document that the new toggle simply can't be honored (always defaults to "on") until the migration runs.
