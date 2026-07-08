---
name: Paystack response shape hardening
description: Pattern for safely handling Paystack API responses to avoid unguarded-property crashes.
---

Paystack's REST API sometimes returns a 2xx HTTP status with a response body that doesn't have the expected nested `data.data` shape (e.g. edge cases on `/transaction/initialize` and `/transaction/verify`). Code that does `res.data.data.someField` without a null-check will throw an uncaught `TypeError`, which surfaces to the client as an unhandled 500 — this was the root cause of a "upgrading a subscription returns HTTP 500" production bug.

**Why:** `paystackRequest()` only throws when `!res.ok`; it does not validate the shape of a 200 response body. Any code downstream that assumes `data.data.x` exists is trusting an external API's shape without verification.

**How to apply:** After any `paystackRequest()` call, null-check the specific field you need (`data?.data?.authorization_url`, `data?.data`, etc.) before using it, and return a clean 502 with a support-actionable message if it's missing — don't let it throw. The same applies to `metadata` on a verify/webhook payload: default it to `{}` and validate required keys (`userId`, `planId`) exist before writing to the DB.
