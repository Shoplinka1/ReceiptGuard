# ReceiptGuard — Deployment Checklist

## Step 1 — Run Supabase migration

Open **Supabase Dashboard → SQL Editor** and run the full contents of `supabase/migration.sql`.

This will:
- Apply all schema changes (new columns, Phase 2 & 3 blocks)
- **DELETE** all receipts with amount > $50,000 or < $0.50 (Bybit and similar crypto
  exchange emails that corrupted dashboard stats)
- **DELETE** stale activity_log entries that say "up to 500" (old scan limit — now 150)

**Before running**, verify what will be deleted by running this SELECT first:
```sql
SELECT id, merchant_name, amount, purchase_date, raw_email_from
FROM public.receipts
WHERE amount > 50000 OR amount < 0.50 OR amount IS NULL;
```

---

## Step 2 — Set Railway environment variables

Go to **Railway → your api-server service → Variables** and confirm/add:

### Required (app will not work without these)
| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `https://<your-railway-domain>/api/gmail/callback` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (starts with `sk_live_`) |
| `ENCRYPTION_KEY` | 64-character hex string (AES-256 key for Gmail tokens) |
| `FRONTEND_URL` | Your Vercel app URL (e.g. `https://receiptguard.vercel.app`) |

### Required for feedback email delivery
| Variable | Value |
|---|---|
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USER` | `receiptguard01@gmail.com` |
| `EMAIL_PASS` | 16-character Gmail App Password (no spaces) |
| `EMAIL_FROM` | `ReceiptGuard <receiptguard01@gmail.com>` |

> **Gmail App Password**: Go to myaccount.google.com → Security → 2-Step Verification → App passwords.
> Generate one for "Mail" / "Other (ReceiptGuard)". Copy the 16 chars **with no spaces**.

**How to verify email is working after deploy:**
Submit a feedback form in the app, then check Railway logs for:
- ✅ `[email] transporter.verify() succeeded` + `[email] sent successfully`
- ❌ `[email] SMTP not configured` → env vars missing
- ❌ `[email] transporter.verify() FAILED` → wrong host/port/password

---

## Step 3 — Deploy api-server to Railway

Push the latest code to the branch Railway is tracking (typically `main`), or trigger a
manual redeploy in the Railway dashboard.

**Verify after deploy:**
- `GET https://<railway-domain>/api/health` returns `{ "status": "ok" }`
- Railway build logs show no TypeScript errors

**What changes in this deploy:**
- `FREE_SCAN_LIMIT` is now **150** (was 500) — new scans will write "up to 150" to activity logs
- `validAmount()` filter on dashboard routes — amounts outside $0.50–$50,000 are excluded from all stats
- Admin stats: DAU/WAU/MAU, totalReceipts, newProUpgrades30d, churnedCount30d, scanSuccessRate
- Billing: cancel route properly sets `cancel_at_period_end`
- Reminders scheduler: correct column names (`merchant_name`, `body`, `is_read`)

---

## Step 4 — Deploy frontend to Vercel

Push latest code to the branch Vercel is tracking, or trigger a manual redeploy.

**Verify after deploy:**
- Billing page: Pro users see renewal date + Cancel button only (no "Manage Subscription")
- Payment history: shows "ReceiptGuard Pro" (capital P)
- Admin dashboard: shows DAU/WAU/MAU/Total Receipts/Scan Success stats

---

## Step 5 — End-to-end production verification checklist

After both Railway and Vercel are deployed and the Supabase migration has run:

| Check | How to verify |
|---|---|
| Bybit receipt gone | Dashboard → Top Merchants: no Bybit entry |
| Scan limit = 150 | Connect Gmail → trigger scan → Recent Activity shows "up to 150" |
| Receipt storage limit | Free user: 51st receipt scan should stop and notify |
| Feedback email | Submit feedback → check Railway logs for `[email] sent successfully` |
| Billing upgrade | Click "Upgrade to Pro" → Paystack checkout → verify redirect back |
| Billing cancel | Pro user → Billing → Cancel → confirm renewal date shown, cancel button hides |
| Payment history | Billing → Payment History → entries show "ReceiptGuard Pro" |
| Admin stats | `/admin` → Overview → DAU / WAU / MAU / Total Receipts visible |
| Dashboard math | Monthly Spending + Top Merchants: no amounts above $50,000 |
| Auto-downgrade | Wait for an expired subscription to verify plan reverts to Free |
