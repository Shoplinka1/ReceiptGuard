---
name: Webhook failure HTTP status semantics
description: Decision on how payment/webhook handlers should signal internal failures to the provider.
---

When a webhook handler (e.g. Paystack's `/api/paystack/webhook`) hits an internal error (DB write failure, unexpected payload shape) partway through processing an event, it must return a 5xx status — not swallow the error and return 200.

**Why:** Returning 200 unconditionally acknowledges the event as fully processed even when it wasn't, so the provider will never retry it. This causes silent, hard-to-diagnose state loss (e.g. a plan downgrade or failed-payment record that never gets applied). Returning 5xx trades a small risk of duplicate side effects (e.g. a duplicate `activity_logs` row) on retry for guaranteed eventual consistency.

**How to apply:** Wrap webhook event-processing logic in try/catch. On success, return 200. On any exception, log it and return `res.sendStatus(500)` so the provider's retry mechanism kicks in. Make sure the handlers themselves are safe to re-run (idempotent updates; tolerate duplicate log/history rows) since they may be retried multiple times.
