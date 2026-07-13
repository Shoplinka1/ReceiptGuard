---
name: Gmail scan partial-failure reporting
description: How partial Gmail search-query failures are surfaced without breaking admin success-rate metrics
---

When some (not all) of the Gmail search queries in a scan fail (e.g. transient 429/5xx on one
of three subject queries), the scan now logs an activity_logs row of type `gmail_scan_partial`
(not `gmail_scan_complete`) and appends a note to the completion description.

**Why:** Originally only "all queries failed" was treated as a failure; a single query failing
while others succeeded looked identical to a clean success, silently under-importing receipts
with no signal to the user.

**How to apply:** Any code that reads `activity_logs` filtered by `type = 'gmail_scan_complete'`
(e.g. admin scan-success-rate metrics) must also include `gmail_scan_partial` as a success bucket,
or partial scans will wrongly count against the success rate. Already fixed in admin.ts stats query.
