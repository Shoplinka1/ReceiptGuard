---
name: Gmail receipt amount sign/refund detection
description: How extractAmount() in gmail.ts detects negative (refund) amounts and how refund emails are filtered
---

`extractAmount()`'s regexes each capture an explicit optional leading `-`/`(`
group (group 1) positioned right before the currency symbol/number itself —
not before the whole match. This matters because the label-based pattern's
match starts at the label text ("Amount charged: -$12.99"), so checking the
character before `m.index` or before `m[0]` misses the sign; it has to be
captured in-pattern, immediately adjacent to the symbol/number.

**Why:** an earlier fix checked the character preceding the full regex match,
which worked for the bare `$12.99` pattern but silently missed
label-prefixed negatives like `"Amount charged: -$12.99"` — refunds were
still counted as positive spending in that case.

**How to apply:** if adding a new amount-extraction pattern, give it the same
`([-(])?\s*` capture group immediately before the currency symbol/number, and
check `m[1] === '-' || m[1] === '('` to reject it — don't rely on scanning
`text` around `m.index`.

Refund/credit emails are also filtered by subject (`REFUND_SUBJECT_PATTERNS`)
and body (`REFUND_BODY_PATTERNS`) regexes. The body patterns are deliberately
narrow (require phrasing like "has been refunded" / "we refunded" / "credited
back to your card") rather than a bare `/refund/i`, because ordinary receipts
often contain refund-policy boilerplate ("request a refund within 30 days")
that a bare match would misclassify as an already-refunded transaction and
wrongly skip.
