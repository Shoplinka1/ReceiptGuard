---
name: Supabase Google OAuth Setup
description: Google sign-in via Supabase requires dashboard config — cannot be done in code alone.
---

The "Run this app" / blank page error after Google OAuth means Supabase is redirecting to the wrong URL.

**User must do in Supabase Dashboard:**
1. Authentication > Providers > Google: enable it, paste GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
2. Authentication > URL Configuration:
   - Site URL: set to the Replit app domain (e.g. https://xxxx.worf.replit.dev)
   - Redirect URLs: add `https://*.replit.dev/**` (wildcard covers all Replit preview domains)

**Why:** Supabase allowlists redirect URLs. If the current domain isn't allowlisted, Supabase falls back to the Site URL, which may be a stale/non-running Replit URL.

The GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars in Replit are used by the API server for Gmail OAuth (reading emails). Supabase needs its own copy configured in its dashboard separately.

The Supabase client uses `flowType: 'pkce'` for more reliable OAuth in SPAs.
