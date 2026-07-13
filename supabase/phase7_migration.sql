-- ReceiptGuard Phase 7 Migration
-- Fixes admin access, backfills missing profile rows, and adds PostgREST join FKs.
-- Run this in your Supabase SQL Editor.
-- SAFE to run on already-migrated databases (all blocks are idempotent).

-- ─── Step 1: Backfill profile rows for auth users that have none ─────────────
-- The handle_new_user trigger creates profiles on sign-up. If it was not yet
-- installed when the first users signed up via Google OAuth, those users have
-- no profile row, which causes "Profile not found" errors across the app.
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
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Step 3: Add FK from email_accounts.user_id → profiles.id ────────────────
-- This lets PostgREST do email_accounts → profiles joins in admin queries.
-- Safe because all email_account rows reference existing auth users, and Step 1
-- ensures every auth user now has a profiles row.
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

-- ─── Step 4: Add FK from payments.user_id → profiles.id ──────────────────────
-- Same reason as Step 3 — allows PostgREST to join payments → profiles.
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

-- ─── Step 5: Add FK from subscriptions.user_id → profiles.id ─────────────────
DO $phase7c$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_profiles_fkey'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $phase7c$;

-- ─── Step 6: Add FK from receipts.user_id → profiles.id ──────────────────────
DO $phase7d$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipts_profiles_fkey'
  ) THEN
    ALTER TABLE public.receipts
      ADD CONSTRAINT receipts_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $phase7d$;

-- ─── Step 7: Ensure is_admin and is_suspended columns exist ──────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin     boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- ─── Step 8: Grant admin access ──────────────────────────────────────────────
-- IMPORTANT: Replace the email below with your actual admin account email
-- before running this step. Only run once.
--
-- UPDATE public.profiles
-- SET is_admin = true
-- WHERE email = 'your-admin-email@example.com';
--
-- To verify it worked:
-- SELECT id, email, is_admin FROM public.profiles WHERE is_admin = true;

-- ─── Step 9: Backfill settings rows for users that have none ─────────────────
INSERT INTO public.settings (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.settings)
ON CONFLICT (user_id) DO NOTHING;

-- ─── Done ─────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.profiles)         AS total_profiles,
  (SELECT COUNT(*) FROM auth.users)              AS total_auth_users,
  (SELECT COUNT(*) FROM public.profiles WHERE is_admin) AS admin_count,
  'Phase 7 migration complete. Remember to run Step 8 (grant is_admin) manually.' AS status;
