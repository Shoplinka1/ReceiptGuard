-- ReceiptGuard Phase 7 Migration
-- Fixes admin access, backfills missing profile rows, and adds FK relationships
-- so PostgREST can resolve table joins correctly.
--
-- CONTEXT — why two subscription tables exist:
--   • public.subscriptions       — the subscription TRACKER feature. Stores
--     services users track (Netflix, Spotify, etc). Many rows per user.
--     Written by the user manually and by the Gmail scanner.
--   • public.user_subscriptions  — the Paystack BILLING record. One row per
--     user. Tracks the user's ReceiptGuard plan (Free/Pro) as managed by
--     Paystack. Written exclusively by the Paystack webhook handler.
--   These are completely different tables. Neither is legacy. Do not merge them.
--
-- CONTEXT — why support_messages exists but is unused:
--   • public.support_messages was defined in schema.sql for a planned threaded
--     admin-reply feature that was never implemented. Zero backend/frontend
--     references. It is a dead table and does not cause any bugs. Leave it.
--
-- Run this in your Supabase SQL Editor.
-- SAFE to run on already-migrated databases (all blocks are idempotent).

-- ─── Step 1: Backfill profile rows for auth users that have none ─────────────
-- The handle_new_user trigger creates profiles on sign-up. If it was not yet
-- installed when the first users signed up via Google OAuth, those users have
-- no profile row, which causes 500/404 "Profile not found" errors across the
-- app and prevents the admin check from working.
-- This INSERT is the prerequisite for Steps 3–8 (all of which add FKs that
-- require every auth user to already have a matching profiles row).
INSERT INTO public.profiles (id, email, full_name, avatar_url, plan_id)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url',
  'free'
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- ─── Step 2: Ensure the handle_new_user trigger is installed correctly ────────
-- CREATE OR REPLACE is idempotent. DROP TRIGGER IF EXISTS + CREATE avoids
-- "trigger already exists" errors on re-runs.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name,  profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Step 3: Ensure is_admin and is_suspended columns exist on profiles ───────
-- ADD COLUMN IF NOT EXISTS is a no-op if the column already exists.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin     boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- ─── Step 4: FK from email_accounts.user_id → profiles.id ────────────────────
-- Allows PostgREST to join email_accounts → profiles in admin queries.
-- Safe: Step 1 ensures all auth users now have a profiles row.
DO $phase7a$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_accounts_profiles_fkey'
  ) THEN
    ALTER TABLE public.email_accounts
      ADD CONSTRAINT email_accounts_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $phase7a$;

-- ─── Step 5: FK from payments.user_id → profiles.id ──────────────────────────
DO $phase7b$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_profiles_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $phase7b$;

-- ─── Step 6: FK from feedback.user_id → profiles.id ─────────────────────────
-- Needed so admin feedback queries can join to profiles to get email/name.
-- The GET /api/admin/feedback route was returning empty/broken data because
-- feedback.user_id referenced auth.users (not profiles) and PostgREST could
-- not build the embedded profiles join. Now fixed in app code with manual join;
-- this FK is added for schema completeness and future PostgREST compatibility.
DO $phase7c$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_profiles_fkey'
  ) THEN
    ALTER TABLE public.feedback
      ADD CONSTRAINT feedback_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $phase7c$;

-- ─── Step 7: FK from subscriptions.user_id → profiles.id ────────────────────
-- NOTE: "subscriptions" here is the subscription TRACKER table (Netflix, etc.),
-- NOT user_subscriptions (the Paystack billing record).
DO $phase7d$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_profiles_fkey'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $phase7d$;

-- ─── Step 8: FK from user_subscriptions.user_id → profiles.id ───────────────
-- NOTE: "user_subscriptions" is the Paystack BILLING record (Free/Pro plan),
-- NOT the subscription tracker table above.
DO $phase7e$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_profiles_fkey'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $phase7e$;

-- ─── Step 9: FK from receipts.user_id → profiles.id ─────────────────────────
DO $phase7f$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipts_profiles_fkey'
  ) THEN
    ALTER TABLE public.receipts
      ADD CONSTRAINT receipts_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $phase7f$;

-- ─── Step 10: Backfill settings rows for users that have none ────────────────
INSERT INTO public.settings (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.settings)
ON CONFLICT (user_id) DO NOTHING;

-- ─── Step 11: Grant admin access ─────────────────────────────────────────────
-- REQUIRED — without this, is_admin stays false for everyone and the admin
-- dashboard returns 403 for all users.
--
-- Uncomment the UPDATE below, replace the email, then run:
--
-- UPDATE public.profiles
-- SET is_admin = true
-- WHERE email = 'your-admin-email@example.com';
--
-- Verify it worked:
-- SELECT id, email, is_admin FROM public.profiles WHERE is_admin = true;

-- ─── Verification query (read-only, always runs) ──────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.profiles)                          AS total_profiles,
  (SELECT COUNT(*) FROM auth.users)                              AS total_auth_users,
  (SELECT COUNT(*) FROM public.profiles WHERE is_admin = true)   AS admin_count,
  (SELECT COUNT(*) FROM public.user_subscriptions
   WHERE status = 'active')                                       AS active_paystack_subs,
  (SELECT COUNT(*) FROM public.subscriptions
   WHERE status = 'active')                                       AS active_tracked_subs,
  (SELECT COUNT(*) FROM public.feedback)                         AS total_feedback_rows,
  (SELECT COUNT(*) FROM public.support_messages)                 AS support_messages_rows,
  CASE
    WHEN (SELECT COUNT(*) FROM public.profiles) = (SELECT COUNT(*) FROM auth.users)
    THEN 'OK — all auth users have profile rows'
    ELSE 'WARNING — profile backfill incomplete, check Step 1'
  END AS profile_backfill_status,
  'Phase 7 complete. Run Step 11 (grant is_admin) if admin_count is 0.' AS status;
