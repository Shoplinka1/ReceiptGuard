---
name: Rebase conflict resolution patterns
description: How to resolve the recurring rebase conflicts in this repo and what to watch for
---

# Rebase Conflict Resolution Patterns

## Why conflicts happen
Two parallel session agents commit to the same branch. When a rebase is needed (45 remote commits vs 4 local), conflicts appear across schema column names, scheduler rewrites, and admin UI tabs.

## Column name rule
`schema.sql` was corrected to use `company_name` / `company_logo_url` (not `name` / `merchant_logo_url`). The upstream (origin/main) still has the old names in some commits. Always keep `company_name`/`company_logo_url` as the truth.

## Conflict resolution strategy
- **reminder-scheduler.ts**: always keep HEAD (origin/main) — it has the comprehensive multi-window rewrite; old commits have a single 3-day window
- **admin.ts "both" merge**: SMTP test route (HEAD) + Receipts/Gmail Accounts routes (local commit) must both survive — keep both sections. Watch for missing `});` closing brace when concatenating route handlers this way
- **gmail.ts upsert**: HEAD has comprehensive subscription detection (body scan, yearly billing, month-end safety); fix column names to `company_name`/`onConflict: 'user_id,company_name'` after taking HEAD
- **gmail-scheduler.ts**: `runGmailScan` takes 4 args (`account, userId, forceRescan, isInitialScan`); callers outside gmail.ts must pass all 4

## Post-rebase checklist
1. `formatCurrency` + `currency` var must be in dashboard.tsx, receipts.tsx, subscriptions.tsx — HEAD may drop these; add `useGetUserSettings()` call and `const currency = userSettings?.currency || 'USD'`
2. Check for missing `});` in admin.ts if "both" strategy was used
3. Run `npx tsc --noEmit` — filter out TS6305 (api-client-react not built, harmless) to see real errors

## Node script for bulk conflict resolution
Use `node -e` with a regex replace — python3 is not available in this environment.
```js
const fs = require('fs');
let g = fs.readFileSync(path, 'utf8');
g = g.replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]+\n/g, (_, ours, theirs) => ours); // 'ours' = HEAD
fs.writeFileSync(path, g);
```
