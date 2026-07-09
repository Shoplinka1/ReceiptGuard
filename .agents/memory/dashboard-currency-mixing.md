---
name: Dashboard currency mixing bug
description: Why a $/amount range guard is not enough to keep dashboard money totals correct when receipts/subscriptions are recorded in multiple currencies.
---

Receipts and subscriptions are stored with a raw `amount` plus a separate `currency` column (e.g. USD, NGN). The dashboard's `validAmount` guard (artifacts/api-server/src/routes/dashboard.ts) only rejects amounts outside $0.50–$50,000 — it does not look at `currency`. A charge of "30000" recorded as NGN (≈ $20) is a perfectly valid number in that range, so it passes the guard and gets summed into "Monthly Spending" as if it were $30,000 USD.

**Why:** This surfaced as real corruption from Flutterwave/Paystack (NGN) and legacy Bybit crypto-exchange rows imported before a sender-domain exclusion filter existed. Deleting outlier rows by amount range does not fix mixed-currency rows that happen to fall inside the "valid" range.

**How to apply:** Any aggregate that SUMS money across rows (spending totals, monthly subscription cost, per-merchant totals) must filter to the user's primary currency (`settings.currency`, default `USD`, compare case-insensitively) before summing. Pure counts (e.g. total receipts, upcoming renewals count) are currency-agnostic and should not be filtered by currency. Per later product direction: don't just drop non-primary-currency rows — also return their sums grouped by currency (a breakdown field) so no valid data is silently discarded, while the primary-currency total itself is never mixed. Also do a one-time cleanup of stale receipts from crypto-exchange or other non-purchase senders imported before a sender-domain filter existed — new code filters don't retroactively clean existing rows.
