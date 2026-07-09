-- ReceiptGuard Migration: Add missing tables and columns for users who ran an earlier version of schema.sql
-- Run this in your Supabase SQL Editor if you see errors like:
--   "Could not find the table 'public.feedback'"
--   "column does not exist"
--   "settings" not saving

-- ─── Re-enable uuid extension (safe to run twice) ────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Plans: correct prices to $5.99/$59.99 ───────────────────────────────────
update public.plans set price_monthly = 5.99, price_yearly = 59.99 where id = 'pro';
insert into public.plans (id, name, description, price_monthly, price_yearly, features)
values ('pro', 'Pro', 'Full access for power users', 5.99, 59.99,
  '["Unlimited Gmail accounts","Unlimited receipts","Unlimited subscriptions","Advanced analytics","CSV & PDF export","Warranty tracking","Priority support","Custom categories","Spending reports"]')
on conflict (id) do update set
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly;

-- ─── Profiles: ensure all columns exist ──────────────────────────────────────
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists plan_id text references public.plans(id) default 'free';
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- ─── Payments: add missing columns ───────────────────────────────────────────
alter table public.payments add column if not exists billing_cycle text;
alter table public.payments add column if not exists paid_at timestamptz;
alter table public.payments alter column currency set default 'USD';

-- ─── Settings table (if missing) ─────────────────────────────────────────────
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
  language              text not null default 'en',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.settings enable row level security;
do $policy_settings$ begin
  if not exists (select 1 from pg_policies where tablename = 'settings' and policyname = 'Users can manage own settings') then
    create policy "Users can manage own settings" on public.settings for all using (auth.uid() = user_id);
  end if;
end $policy_settings$;

-- Add language column if settings table already existed without it
alter table public.settings add column if not exists language text not null default 'en';

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

-- Backfill settings for existing users
insert into public.settings (user_id)
select id from auth.users
where id not in (select user_id from public.settings)
on conflict (user_id) do nothing;

-- ─── Feedback table (if missing) ─────────────────────────────────────────────
create table if not exists public.feedback (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  type        text not null,    -- feedback | feature_request | bug_report | support
  subject     text not null,
  body        text not null,
  status      text not null default 'open',   -- open | in_progress | resolved | closed
  metadata    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback(status, created_at desc);
create index if not exists feedback_user_idx on public.feedback(user_id);
alter table public.feedback enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'feedback' and policyname = 'Users can insert feedback') then
    create policy "Users can insert feedback" on public.feedback for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'feedback' and policyname = 'Users can view own feedback') then
    create policy "Users can view own feedback" on public.feedback for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── Support messages table (if missing) ─────────────────────────────────────
create table if not exists public.support_messages (
  id              uuid primary key default uuid_generate_v4(),
  feedback_id     uuid references public.feedback(id) on delete cascade,
  sender          text not null,  -- 'user' | 'admin'
  message         text not null,
  created_at      timestamptz not null default now()
);
alter table public.support_messages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'support_messages' and policyname = 'Users can view support messages for their feedback') then
    create policy "Users can view support messages for their feedback"
      on public.support_messages for select using (
        exists (
          select 1 from public.feedback f
          where f.id = feedback_id and f.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- ─── Email accounts: add last_scanned_at if missing ──────────────────────────
alter table public.email_accounts add column if not exists last_scanned_at timestamptz;
alter table public.email_accounts add column if not exists scopes text[];

-- ─── Subscriptions: add missing columns ──────────────────────────────────────
alter table public.subscriptions add column if not exists company_name text;
alter table public.subscriptions add column if not exists monthly_price numeric(10,2);
alter table public.subscriptions add column if not exists billing_cycle text default 'monthly';
alter table public.subscriptions add column if not exists renewal_date date;
alter table public.subscriptions add column if not exists notes text;

-- Update company_name from name if it exists
update public.subscriptions set company_name = name where company_name is null and name is not null;

-- ─── User subscriptions: add missing columns ─────────────────────────────────
alter table public.user_subscriptions add column if not exists paystack_customer_id text;
alter table public.user_subscriptions add column if not exists current_period_start timestamptz;
alter table public.user_subscriptions add column if not exists current_period_end timestamptz;

-- ─── Phase 2: user_subscriptions additional columns ──────────────────────────
alter table public.user_subscriptions add column if not exists paystack_plan_code text;
alter table public.user_subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.user_subscriptions add column if not exists paystack_subscription_id text;

-- ─── Phase 2: payments — description column ───────────────────────────────────
alter table public.payments add column if not exists description text;

-- ─── Phase 2: feedback — admin_notes, priority columns ───────────────────────
alter table public.feedback add column if not exists admin_notes text;
alter table public.feedback add column if not exists priority text not null default 'normal';

-- ─── Phase 2: notifications — metadata column ────────────────────────────────
alter table public.notifications add column if not exists metadata jsonb;

-- ─── Phase 2: settings — browser_notifications, reminder window columns ──────
alter table public.settings add column if not exists browser_notifications boolean not null default true;
alter table public.settings add column if not exists renewal_reminder boolean not null default true;
alter table public.settings add column if not exists warranty_reminder boolean not null default true;
alter table public.settings add column if not exists return_window_reminder boolean not null default true;
alter table public.settings add column if not exists days_before_30 boolean not null default true;
alter table public.settings add column if not exists days_before_14 boolean not null default true;
alter table public.settings add column if not exists days_before_7 boolean not null default true;
alter table public.settings add column if not exists days_before_3 boolean not null default true;
alter table public.settings add column if not exists days_before_1 boolean not null default false;

-- ─── Phase 3: DELETE malformed receipts (crypto exchanges / invalid amounts) ──
-- Receipts with amount > $50,000 or < $0.50 are corrupted data — crypto
-- exchange account-balance emails that slipped through before domain blocklisting
-- was in place. They corrupt Top Merchants, Monthly Spending, and Trends.
--
-- SAFE TO RUN: these are NOT real purchases. The amount bounds ($0.50–$50,000)
-- match the validAmount() filter in the backend dashboard routes.
--
-- Run this SELECT first to review what will be deleted:
--   SELECT id, merchant_name, amount, purchase_date, raw_email_from
--   FROM public.receipts
--   WHERE amount > 50000 OR amount < 0.50 OR amount IS NULL;
--
-- Then run the DELETE below to remove them permanently.

delete from public.receipts
where amount > 50000 or amount < 0.50 or amount is null;

-- ─── Phase 3: DELETE orphaned warranty records for deleted receipts ───────────
-- Clean up any warranty records whose merchant amounts were in the bad range.
-- Warranties linked to flagged receipts are not real warranties.
delete from public.warranties
where product_name in (
  -- These merchants are known crypto/trading platforms that were erroneously scanned
  'Bybit', 'Binance', 'Coinbase', 'Kraken', 'OKX', 'KuCoin', 'Gate', 'Gemini',
  'Bitfinex', 'Huobi', 'Bitmex', 'Bittrex', 'FTX', 'Deribit', 'Blockchain'
) and purchase_date is not null;

-- ─── Phase 3: Clean up stale activity_log entries showing old scan limit ──────
-- Before FREE_SCAN_LIMIT was set to 150, the backend wrote "up to 500" into
-- activity_logs. These old entries cause the dashboard to display the wrong limit.
-- Delete them so only accurate entries remain.

delete from public.activity_logs
where type in ('gmail_scan_started', 'gmail_scan_complete', 'gmail_scan_failed', 'gmail_scan_limit_reached')
  and description like '%up to 500%';

-- ─── Phase 3: receipts table — add notes column if missing ───────────────────
alter table public.receipts add column if not exists notes text;

-- ─── Done ─────────────────────────────────────────────────────────────────────
select 'Migration complete. All tables and columns are up to date.' as status;
