---
name: Paystack Webhook Verification
description: How Paystack webhook HMAC verification works in this project — uses PAYSTACK_SECRET_KEY, not a separate webhook secret.
---

Paystack does NOT provide a separate webhook signing secret like Stripe.
Webhook events are verified by computing HMAC-SHA512 of the raw request body using PAYSTACK_SECRET_KEY, then comparing to the x-paystack-signature header.

**How to apply:** In `paystack.ts` webhook handler, use `PAYSTACK_SECRET_KEY` for the HMAC. Never require a separate `PAYSTACK_WEBHOOK_SECRET`.

The raw body is captured via `express.raw()` in `app.ts` on the `/api/paystack/webhook` path before `express.json()` runs.
