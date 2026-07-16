-- promote-admin.sql
-- Promotes the configured founder account to administrator.
-- Safe to run multiple times (idempotent).
--
-- Usage:
--   1. Open Supabase Dashboard → SQL Editor.
--   2. Replace the email below with the founder account email.
--   3. Click Run.
--
-- The profiles.is_admin column is checked by both:
--   • The backend adminGuard middleware (requireAdmin in routes/admin.ts)
--   • The frontend ProtectedRoute (GET /api/user/profile → isAdmin field)

UPDATE public.profiles
SET    is_admin = true
WHERE  email    = 'phacodc1@gmail.com'   -- ← change to your admin email
  AND  is_admin IS DISTINCT FROM true;

-- Verify the result:
SELECT id, email, is_admin, plan_id, created_at
FROM   public.profiles
WHERE  email = 'phacodc1@gmail.com';
