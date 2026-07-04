---
name: Supabase Graceful Degradation
description: Both frontend and backend handle missing Supabase env vars with warnings instead of crashes.
---

Frontend (src/lib/supabase.ts): creates client with placeholder URL; exports isSupabaseConfigured flag; logs warning to console. App renders, auth operations gracefully fail.

Backend (src/lib/supabase.ts): uses Proxy; returns { data: null, error: { message: 'Supabase not configured', status: 503 } } from all DB calls; server starts and all routes work but return 503 until secrets are set.

**Why:** Allows the app to render and be previewed during development/setup before Supabase credentials exist.
