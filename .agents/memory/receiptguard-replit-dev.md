---
name: ReceiptGuard Replit dev setup
description: Deployment boundaries and standing engineering rules for continuing ReceiptGuard production work from Replit.
---

Replit is the **development workspace only** for ReceiptGuard. Production stays exactly as-is:
- Frontend → Vercel
- API/backend → Railway
- DB/Auth → Supabase (shared by both prod and this Replit dev instance — same project ref)

Do not deploy, switch providers, or change production URLs/environment architecture from here. Running the app in the Replit preview is fine (dev-only); publishing/deploying it is not part of this project's workflow.

Standing rule from the product owner: treat this as a live production SaaS with real users. Don't rewrite/redesign Gmail OAuth, scanning, parsing, subscription/warranty detection, billing (Paystack), or auth unless a concrete bug is confirmed — audit first, change the smallest thing necessary, explain production-impacting changes before making them.

**Why:** the Supabase project is shared with real production data (confirmed real connected Gmail accounts present during dev), so mistakes here are not sandboxed.
**How to apply:** before big changes, audit/read existing implementation; before deploy-adjacent suggestions, remember Replit's role is dev-only here.
