---
name: Receipt duplicate detection strategy
description: Why merchant+amount+date alone is unsafe as a dedup key, and the tiered approach used instead
---

Gmail-scan duplicate detection uses a tiered identity: prefer the merchant's
own order/invoice number when the parsed email has one (a real unique
identifier — two emails sharing it are always the same purchase), and only
fall back to `merchant|amount|purchase_date` when no order/invoice number was
found, comparing only against other receipts that likewise lack one.

**Why:** merchant+amount+date alone is a weak signal — two separate,
legitimate purchases (a recurring $12 subscription, buying the same item
twice in a day) commonly share all three fields. Deduping on that alone drops
real receipts. This was caught by a review pass before shipping, not
observed in production.

**How to apply:** if extending duplicate detection (e.g. to manual receipt
entry or a "merge duplicates" admin tool), keep this precedence — check
strong identifiers first, and treat merchant/amount/date matches as
"probably a duplicate, ask the user" rather than an automatic skip.
