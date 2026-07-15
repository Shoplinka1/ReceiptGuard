---
name: Resend email integration
description: How ReceiptGuard sends production email (Resend vs legacy SMTP), and how to verify it without dashboard access.
---

`artifacts/api-server/src/lib/email.ts` tries Resend first (`RESEND_API_KEY`), falling back to nodemailer/SMTP (`EMAIL_HOST`/`USER`/`PASS`) if unset, then dev-log. `EMAIL_SENDERS` exports the four getreceiptguard.xyz senders (noreply/support/reminders/feedback) — pass `from` per call to pick one; reminders use `reminders@`, feedback notifications use `feedback@`.

The project's Resend API key is a **send-only restricted key** — `GET /domains` returns 401 `restricted_api_key`. You cannot check domain/SPF/DKIM verification status via the API with this key. To verify email actually works, send a real test via `POST https://api.resend.com/emails` (curl) and check for a 200 + id vs a 403 (domain not verified yet).

**Why:** the key's restriction blocked the obvious verification path (querying domain status), so testing must go through an actual send.
**How to apply:** when auditing/debugging Resend delivery here, don't rely on the domains endpoint — send a real probe email instead.
