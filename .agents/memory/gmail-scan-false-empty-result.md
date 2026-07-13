---
name: Gmail scan false-empty-result bug
description: Why a Gmail rescan could report "0 imported / 0 candidates" even when the connection was actually broken, and how it's now surfaced.
---

`runGmailScan()` ran 3 Gmail search queries per scan and caught each query's
errors individually with a bare `console.warn`, then continued. If every
query failed (e.g. 401/403 from a token that lost Gmail scope, or a 429/5xx
from Gmail), `allIds` stayed empty and the scan wrote a normal-looking
"Scan complete: 0 imported, 0 skipped, 0 failed (of 0 candidates)" activity
log — indistinguishable from a genuinely empty inbox.

**Why:** this made "Gmail scanning imports 0 receipts" undiagnosable from the
UI/activity log alone — the failure signal was thrown away at the point where
it actually happened.

**How to apply:** any per-item retry/gather loop that keeps going after
per-item failures must track those failures separately from "processed 0
items", and if 100% of an all-or-nothing batch fails, treat it as a failure
state (with the real HTTP status/error code in the message), not a success
with a zero count. In gmail.ts this is `queryErrors` + the "all queries
failed" abort branch in `runGmailScan()`. Also: `parseMessage()` now returns
`{ result, skipReason }` so "found messages but imported 0" has a specific,
loggable reason (crypto filter, subject didn't match, no parseable amount)
instead of a bare null.
