---
name: Dashboard currency mixing bug
description: Why a $/amount range guard is not enough to keep dashboard money totals correct when receipts/subscriptions are recorded in multiple currencies.
---

Receipts and subscriptions are stored with a raw `amount` plus a separate `currency` column (e.g. USD, NGN). The dashboard's `validAmount` guard (artifacts/api-server/src/routes/dashboard.ts) only rejects amounts outside $0.50–$50,000 — it does not look at `currency`. A charge of "30000" recorded as NGN (≈ $20) is a perfectly valid number in that range, so it passes the guard and gets summed into "Monthly Spending" as if it were $30,000 USD.

**Why:** This surfaced as real corruption from Flutterwave/Paystack (NGN) and legacy Bybit crypto-exchange rows imported before a sender-domain exclusion filter existed. Deleting outlier rows by amount range does not fix mixed-currency rows that happen to fall inside the "valid" range.

**How to apply:** Any dashboard/report aggregate that sums money (`monthlySpending`, `spending-trend`, `top-merchants`, `subscriptionsMonthlyTotal`, `upcomingRenewalsCount`, etc.) must first filter rows to the user's primary currency (`settings.currency`, default `USD`, compare case-insensitively) before summing — not just guard the numeric range. Rows in another currency should still count toward non-monetary totals (e.g. `totalReceipts`) but must be excluded from money sums. Also do a one-time cleanup of any stale receipts from crypto-exchange or other non-purchase senders that were imported before a sender-domain filter existed — code filters going forward don't retroactively clean existing rows.
