---
name: ENCRYPTION_KEY format
description: What format ENCRYPTION_KEY must be for Gmail token encryption (AES-256-CBC).
---

# ENCRYPTION_KEY Railway env var

## Required format
- Exactly **64 hexadecimal characters** (represents 32 bytes for AES-256-CBC)
- Must match regex `/^[0-9a-f]{64}$/i`
- Set as `ENCRYPTION_KEY` in Railway environment variables

## How to generate a new key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Where it's used
`artifacts/api-server/src/routes/gmail.ts` — `encrypt()` and `decrypt()` functions store/retrieve OAuth tokens in `email_accounts.access_token_enc` and `refresh_token_enc` columns.

## What breaks without it
- Gmail OAuth callback redirects to `/settings?tab=gmail&error=encryption_key_invalid`
- Gmail token refresh fails with "Failed to refresh Gmail token. User must reconnect Gmail."
- All Gmail scanning is blocked

**Why:** AES-256 key must be exactly 32 bytes. A 64-char hex string decodes to exactly 32 bytes via `Buffer.from(key, 'hex')`. Any other format causes `Invalid key length`.

## IMPORTANT
If the key is changed after tokens are already encrypted and stored, all existing Gmail connections break (tokens become undecryptable). Users will need to reconnect Gmail after a key rotation.
