---
name: Dashboard metrics design
description: What each dashboard widget shows, the query behind it, and known design decisions.
---

# Dashboard Metrics Reference

## Monthly Spending
- Query: `receipts WHERE user_id = ? AND purchase_date >= first_of_month`
- Filter: `validAmount` range $0.50–$50,000 (excludes noise and crypto balances)
- No mismatch: calculation is sound.

## Monthly Subs (renamed from "Money Saved")
- Source field: `subscriptionsMonthlyTotal` = sum of monthly_price for monthly subs
  + yearly_price/12 for yearly subs, among active subscriptions
- Previously labeled "Money Saved" and showed `moneySaved = monthlySubTotal * 0.15`
  (arbitrary 15% discount estimate) — this was misleading and confusing.
- Frontend now shows `subscriptionsMonthlyTotal` labeled "Monthly Subs".
- `annualSavings` (= monthlySubTotal * 12 * 0.20) is surfaced as a subtext hint.

## Spending Trend
- Query: all receipts, client-side grouped into 6-month buckets
- Y-axis now has `$` prefix via tickFormatter and Tooltip formatter

## Active Subscriptions
- Query: `subscriptions WHERE user_id = ? AND status = 'active'`
- Count is straightforward. No issues.

## Upcoming Renewals
- Query: `subscriptions WHERE status = 'active' AND renewal_date BETWEEN today AND today+30`
- Was always 0 because Gmail scan never set renewal_date. Fixed: see subscription-renewal-date.md

## Warranties (count)
- Query: `warranties WHERE user_id = ?` filtered to `warranty_end_date >= today`
- safeFormatDate() helper added to frontend to null-guard dates without crashing

## Design decision: validAmount filter
$0.50–$50,000 applied to both Monthly Spending and Top Merchants to exclude
misparsed crypto exchange balances and sub-cent noise. Both endpoints apply
the same filter so numbers are consistent.
