---
name: Renewal Reminder Scheduler
description: Background job in api-server that emails users 3 days before subscriptions renew.
---

File: `artifacts/api-server/src/lib/reminder-scheduler.ts`
Email helper: `artifacts/api-server/src/lib/email.ts`
Started in: `artifacts/api-server/src/index.ts` after server.listen()

**How it works:**
- Runs every hour via setInterval
- Queries `renewals` table for rows with `status=upcoming` and `renewal_date` in the next 3 days
- Creates a `notifications` row (deduped per day per renewalId)
- Sends email via nodemailer if EMAIL_HOST/EMAIL_USER/EMAIL_PASS are set; otherwise logs to stdout

**Email config env vars (optional, add to Replit Secrets):**
- EMAIL_HOST, EMAIL_PORT (default 587), EMAIL_USER, EMAIL_PASS, EMAIL_FROM
- Without these, scheduler still creates DB notifications, just no actual email sent

**Why scheduler logs DB error on startup:** The `renewals` table doesn't exist until user runs `supabase/schema.sql` in Supabase SQL Editor.
