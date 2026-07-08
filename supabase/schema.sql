-- ReceiptGuard — Complete Production Schema
-- Paste this entire file into the Supabase SQL Editor and click Run.
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE).

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";    -- for fast text search on receipts

-- ─── Profiles ────────────────────────────────────────────────────────────────
-- Mirrors auth.users. Created automatically by a trigger on signup.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  plan_id       text not null default 'free',   -- 'free' | 'pro'
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Admin bypass: service role bypasses RLS automatically.

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Plans ───────────────────────────────────────────────────────────────────
create table if not exists public.plans (
  id              text primary key,              -- 'free' | 'pro'
  name            text not null,
  description     text,
  price_monthly   numeric(10,2) not null default 0,   -- USD
  price_yearly    numeric(10,2) not null default 0,   -- USD
  features        jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.plans enable row level security;
create policy "Anyone can view plans" on public.plans for select using (true);

insert into public.plans (id, name, description, price_monthly, price_yearly, features) values
('free', 'Free', 'Get started tracking your receipts', 0, 0, '["1 Gmail account","Up to 50 receipts","Up to 5 subscriptions","Basic dashboard","Basic reminders"]'),
('pro', 'Pro', 'Full access for power users', 5.99, 59.99, '["Unlimited Gmail accounts","Unlimited receipts","Unlimited subscriptions","Advanced analytics","CSV & PDF export","Warranty tracking","Priority support","Custom categories","Spending reports"]')
on conflict (id) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  features = excluded.features;

-- ─── Email Accounts (Gmail connections) ─────────────────────────────────────
create table if not exists public.email_accounts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  email               text not null,
  provider            text not null default 'gmail',
  access_token_enc    text,          -- AES-256-CBC encrypted
  refresh_token_enc   text,          -- AES-256-CBC encrypted
  token_expiry        timestamptz,
  scopes              text[],
  is_active           boolean not null default true,
  last_scanned_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, email)
);

alter table public.email_accounts enable row level security;
create policy "Users can view own email accounts"
  on public.email_accounts for select using (auth.uid() = user_id);
create policy "Users can delete own email accounts"
  on public.email_accounts for delete using (auth.uid() = user_id);

-- ─── Receipts ────────────────────────────────────────────────────────────────
create table if not exists public.receipts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  email_account_id    uuid references public.email_accounts(id) on delete set null,
  gmail_message_id    text,                   -- prevents duplicate imports
  merchant_name       text not null,
  merchant_logo_url   text,
  amount              numeric(12,2) not null,
  currency            text not null default 'USD',
  purchase_date       date not null,
  category            text not null default 'other',
  status              text not null default 'confirmed',  -- confirmed | pending | refunded
  invoice_number      text,
  order_id            text,
  payment_method      text,
  warranty_months     int,
  warranty_end_date   date,
  notes               text,
  raw_email_subject   text,
  raw_email_from      text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index if not exists receipts_user_id_idx on public.receipts(user_id);
create index if not exists receipts_purchase_date_idx on public.receipts(user_id, purchase_date desc);
create index if not exists receipts_category_idx on public.receipts(user_id, category);
create index if not exists receipts_merchant_trgm on public.receipts using gin(merchant_name gin_trgm_ops);

alter table public.receipts enable row level security;
create policy "Users can view own receipts"
  on public.receipts for select using (auth.uid() = user_id);
create policy "Users can insert own receipts"
  on public.receipts for insert with check (auth.uid() = user_id);
create policy "Users can update own receipts"
  on public.receipts for update using (auth.uid() = user_id);
create policy "Users can delete own receipts"
  on public.receipts for delete using (auth.uid() = user_id);

-- ─── Subscriptions ───────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  merchant_name       text,
  merchant_logo_url   text,
  amount              numeric(10,2),
  monthly_price       numeric(10,2),
  yearly_price        numeric(10,2),
  currency            text not null default 'USD',
  billing_cycle       text not null default 'monthly',    -- monthly | yearly | weekly
  category            text default 'software',
  status              text not null default 'active',     -- active | cancelled | paused | trial
  renewal_date        date,
  trial_ends_at       date,
  cancellation_url    text,
  notes               text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_renewal_idx on public.subscriptions(user_id, renewal_date);

alter table public.subscriptions enable row level security;
create policy "Users can manage own subscriptions"
  on public.subscriptions for all using (auth.uid() = user_id);

-- ─── Renewals ────────────────────────────────────────────────────────────────
create table if not exists public.renewals (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  subscription_id     uuid references public.subscriptions(id) on delete cascade,
  merchant_name       text not null,
  amount              numeric(10,2),
  currency            text not null default 'USD',
  renewal_date        date not null,
  status              text not null default 'upcoming',   -- upcoming | paid | cancelled | failed
  notified_at         timestamptz,
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists renewals_user_date_idx on public.renewals(user_id, renewal_date);

alter table public.renewals enable row level security;
create policy "Users can manage own renewals"
  on public.renewals for all using (auth.uid() = user_id);

-- ─── Warranties ──────────────────────────────────────────────────────────────
create table if not exists public.warranties (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  receipt_id          uuid references public.receipts(id) on delete set null,
  product_name        text not null,
  merchant_name       text,
  purchase_date       date,
  warranty_end_date   date not null,
  warranty_months     int,
  status              text not null default 'active',     -- active | expired | claimed
  notes               text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists warranties_user_id_idx on public.warranties(user_id);
create index if not exists warranties_end_date_idx on public.warranties(user_id, warranty_end_date);

alter table public.warranties enable row level security;
create policy "Users can manage own warranties"
  on public.warranties for all using (auth.uid() = user_id);

-- ─── Reminders ───────────────────────────────────────────────────────────────
create table if not exists public.reminders (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  type                text not null,    -- renewal | warranty | custom
  ref_id              uuid,             -- subscription_id or warranty_id
  title               text not null,
  remind_at           timestamptz not null,
  repeat_interval     text,             -- daily | weekly | monthly | null
  is_sent             boolean not null default false,
  sent_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists reminders_user_idx on public.reminders(user_id, remind_at);

alter table public.reminders enable row level security;
create policy "Users can manage own reminders"
  on public.reminders for all using (auth.uid() = user_id);

-- ─── Payments ────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  paystack_reference  text unique,
  amount              numeric(12,2) not null,
  currency            text not null default 'USD',
  status              text not null default 'pending',    -- pending | success | failed | refunded
  plan_id             text references public.plans(id),
  billing_cycle       text,                               -- monthly | yearly
  description         text,
  metadata            jsonb,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments(user_id);

alter table public.payments enable row level security;
create policy "Users can view own payments"
  on public.payments for select using (auth.uid() = user_id);

-- ─── User Subscriptions (billing) ────────────────────────────────────────────
create table if not exists public.user_subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null unique references auth.users(id) on delete cascade,
  plan_id                 text not null references public.plans(id),
  status                  text not null default 'active',   -- active | cancelled | past_due
  paystack_customer_id    text,
  paystack_subscription_id text,
  paystack_plan_code      text,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  cancelled_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;
create policy "Users can view own subscription"
  on public.user_subscriptions for select using (auth.uid() = user_id);

-- ─── Notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  is_read     boolean not null default false,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Users can manage own notifications"
  on public.notifications for all using (auth.uid() = user_id);

-- ─── Settings ────────────────────────────────────────────────────────────────
create table if not exists public.settings (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  currency              text not null default 'USD',
  timezone              text not null default 'UTC',
  email_notifications   boolean not null default true,
  renewal_reminder_days int not null default 7,
  warranty_reminder_days int not null default 30,
  weekly_summary        boolean not null default true,
  theme                 text not null default 'system',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.settings enable row level security;
create policy "Users can manage own settings"
  on public.settings for all using (auth.uid() = user_id);

-- Auto-create settings row on signup
create or replace function public.handle_new_user_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_settings on auth.users;
create trigger on_auth_user_settings
  after insert on auth.users
  for each row execute function public.handle_new_user_settings();

-- ─── Activity Logs ───────────────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  type        text not null,
  description text,
  metadata    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index if not exists activity_logs_user_idx on public.activity_logs(user_id, created_at desc);
create index if not exists activity_logs_type_idx on public.activity_logs(type, created_at desc);

alter table public.activity_logs enable row level security;
create policy "Users can view own activity"
  on public.activity_logs for select using (auth.uid() = user_id);

-- ─── Feedback ────────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  type        text not null,    -- feedback | feature_request | bug_report | support
  subject     text not null,
  body        text not null,
  status      text not null default 'open',   -- open | in_progress | resolved | closed
  priority    text not null default 'normal', -- low | normal | high | urgent
  admin_notes text,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists feedback_status_idx on public.feedback(status, created_at desc);
create index if not exists feedback_user_idx on public.feedback(user_id);

alter table public.feedback enable row level security;
create policy "Users can insert feedback"
  on public.feedback for insert with check (auth.uid() = user_id);
create policy "Users can view own feedback"
  on public.feedback for select using (auth.uid() = user_id);

-- ─── Support Messages ────────────────────────────────────────────────────────
create table if not exists public.support_messages (
  id              uuid primary key default uuid_generate_v4(),
  feedback_id     uuid references public.feedback(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  is_admin        boolean not null default false,
  body            text not null,
  created_at      timestamptz not null default now()
);

alter table public.support_messages enable row level security;
create policy "Users can view support messages for their feedback"
  on public.support_messages for select
  using (exists (
    select 1 from public.feedback f
    where f.id = feedback_id and f.user_id = auth.uid()
  ));
create policy "Users can send support messages"
  on public.support_messages for insert
  with check (auth.uid() = user_id and is_admin = false);

-- ─── Schema migrations (safe to run on existing databases) ──────────────────

-- Add language and browser_notifications to settings (added after initial deploy)
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'language'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN language text NOT NULL DEFAULT 'en';
  END IF;
END $;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'browser_notifications'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN browser_notifications boolean NOT NULL DEFAULT true;
  END IF;
END $;

-- Add is_suspended to profiles (added after initial deploy)
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_suspended boolean NOT NULL DEFAULT false;
  END IF;
END $body$;

-- Add reminder preference boolean columns to settings (added after initial deploy)
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'renewal_reminder'
  ) THEN
    ALTER TABLE public.settings
      ADD COLUMN renewal_reminder      boolean NOT NULL DEFAULT true,
      ADD COLUMN warranty_reminder     boolean NOT NULL DEFAULT true,
      ADD COLUMN return_window_reminder boolean NOT NULL DEFAULT true,
      ADD COLUMN days_before_30        boolean NOT NULL DEFAULT true,
      ADD COLUMN days_before_14        boolean NOT NULL DEFAULT true,
      ADD COLUMN days_before_7         boolean NOT NULL DEFAULT true,
      ADD COLUMN days_before_3         boolean NOT NULL DEFAULT true,
      ADD COLUMN days_before_1         boolean NOT NULL DEFAULT false;
  END IF;
END $body$;

-- ─── Done ────────────────────────────────────────────────────────────────────
-- All tables, RLS policies, indexes, and triggers have been created.
-- Next: In Supabase > Auth > Providers, enable Google OAuth and set your
-- Google Client ID and Secret.
-- Run all the DO $body$ migration blocks above on existing databases to add
-- new columns: language, browser_notifications, is_suspended, and reminder flags.
