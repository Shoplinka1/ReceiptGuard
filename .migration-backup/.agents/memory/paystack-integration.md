---
name: Paystack Integration Contracts
description: Frontend↔backend API contracts for Paystack checkout, history, webhook, and currency conventions.
---

Initialize checkout:
- POST /api/paystack/initialize
- Request body: { planId: 'pro', billingCycle: 'monthly' }
- Response: { authorizationUrl: string, reference: string }  (camelCase, not authorization_url)

Payment verification on redirect:
- GET /api/paystack/verify/:reference  (called by billing.tsx on ?ref= query param)
- Response: { status: 'success'|'failed', planId: string }

Payment history:
- GET /api/paystack/payments  (NOT /api/paystack/history)

Cancel: POST /api/paystack/cancel

Webhook security:
- PAYSTACK_WEBHOOK_SECRET must be set or webhook returns 503 (fail-closed).
- app.ts registers express.raw({ type: 'application/json' }) on /api/paystack/webhook BEFORE express.json().
- paystack.ts reads req.body as Buffer, verifies HMAC-sha512 against raw bytes, then JSON.parse()s.

Currency/amounts:
- All amounts stored in NGN major units (e.g. 4999 = ₦4,999).
- amountKobo sent to Paystack API; stored amount = amountKobo / 100.
- Never divide by 100 when displaying from DB — amounts are already in major units.
- Frontend billing.tsx and admin.tsx use Number(p.amount).toLocaleString() directly.

**Why:** Paystack signs the raw request bytes. Re-serializing parsed JSON can produce a different byte sequence and fail verification.
