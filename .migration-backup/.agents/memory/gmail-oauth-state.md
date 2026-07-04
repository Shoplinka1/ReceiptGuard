---
name: Gmail OAuth State Signing
description: How the Gmail OAuth state parameter is signed to prevent CSRF/IDOR account-linking attacks.
---

auth-url endpoint builds state as:
1. payload = JSON.stringify({ userId, nonce: 16-byte hex })
2. signature = HMAC-sha256(SESSION_SECRET ?? GOOGLE_CLIENT_SECRET, payload).hex()
3. state = base64url(JSON.stringify({ p: payload, s: signature }))

callback endpoint verifies:
1. Decode base64url → { p, s }
2. Recompute HMAC with same key
3. timingSafeEqual(expected, received) — reject if mismatch
4. JSON.parse(p) → { userId, nonce }

**Why:** Plain base64(userId) allows any attacker who knows a victim's userId to forge state and link their own Google account to the victim's profile (IDOR/account-linking CSRF).

**How to apply:** SESSION_SECRET must be set in production. If missing, falls back to GOOGLE_CLIENT_SECRET. Both must be present for Gmail OAuth to work.
