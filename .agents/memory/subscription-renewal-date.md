---
name: Subscription renewal_date backfill
description: Why Upcoming Renewals was always 0, and the two-step fix applied.
---

# Subscription renewal_date was never set from Gmail scan

## Rule: Gmail scan must write renewal_date AND backfill null rows
When auto-importing subscriptions from Gmail scan, `renewal_date` was not
being set at insertion time. This caused `upcomingRenewalsCount` to always
return 0 (the WHERE clause filters on `renewal_date BETWEEN today AND today+30`).

The fix has two parts:
1. Compute `renewalDate` before the `upsert` call using a **calendar-safe** algorithm
   (see below) and include it in the inserted row.
2. After the upsert (which uses `ignoreDuplicates: true`), run a targeted
   `UPDATE … WHERE renewal_date IS NULL` to backfill rows that were imported
   before this fix.

**Why:** `ignoreDuplicates: true` skips the entire conflict row — it does not
merge fields. Without the separate UPDATE, any subscription imported before
this fix would keep `renewal_date = null` forever on subsequent rescans.

## Rule: Use calendar-safe month arithmetic, not setMonth(+1)

`new Date(d).setMonth(d.getMonth() + 1)` overflows at month-end:
- Jan 31 → March 2 (not Feb 28)
- March 31 → May 1 (not April 30)

Correct approach: compute target year/month explicitly, then clamp the day to
`lastDayOfTargetMonth` using `new Date(tgtYear, tgtMonth + 1, 0).getDate()`.

```typescript
const tgtMonth = (srcMonth + 1) % 12;
const tgtYear  = srcMonth === 11 ? srcYear + 1 : srcYear;
const lastDay  = new Date(tgtYear, tgtMonth + 1, 0).getDate();
const tgtDay   = Math.min(srcDay, lastDay);
```

Same pattern applies for yearly (+1 year): clamp to last day of the same month
in the target year (handles Feb 29 in non-leap-year targets).

**How to apply:** Any code that advances a date by N months must use this
clamped approach, not `setMonth`.
