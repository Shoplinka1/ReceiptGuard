-- ReceiptGuard — Supabase Production Schema
-- Run this in Supabase SQL Editor after creating your project.
-- Requires: auth.users table (managed by Supabase Auth)

-- ─────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- PLANS
-- ─────────────────────────────────────────────────────────────
create table if not exists plans (
  id            text primary key,          -- 'free' | 'pro' | 'enterprise'
  name          text not null,
  price_monthly numeric(10,2) default 0,
  price_yearly  numeric(10,2) default 0,
  max_gmail_accounts int default 1,
  max_receipts       int default 50,       -- -1 = unlimited
  max_subscriptions  int default 5,        -- -1 = unlimited
  features      text[] default '{}',
  created_at    timestamptz default now()
);

insert into plans (id, name, price_monthly, price_yearly, max_gmail_accounts, max_receipts, max_subscriptions, features)
values
  ('free',       'Free',       0,    0,    1,  50, 5,  array['Basic dashboard','Search','Basic reminders']),
  ('pro',        'Pro',        5.99, 49,  -1, -1, -1,  array['Unlimited receipts','Unlimited subscriptions','Warranty tracking','Return tracking','CSV export','PDF export','Spending reports','Advanced filters','Custom categories','Priority support']),
  ('enterprise', 'Enterprise', 0,    0,   -1, -1, -1,  array['Everything in Pro','Custom integrations','Dedicated support'])
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- PROFILES  (extends auth.users)
-- ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  plan_id         text references plans(id) default 'free',
  is_admin        boolean default false,
  is_suspended    boolean default false,
  timezone        text default 'UTC',
  currency        text default 'USD',
  language        text default 'en',
  theme           text default 'system',
  email_notifications boolean default true,
  browser_notifications boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-create profile on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- USER_SUBSCRIPTIONS  (Paystack plan)
-- ─────────────────────────────────────────────────────────────
create table if not exists user_subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  plan_id             text not null references plans(id),
  paystack_customer_id     text,
  paystack_subscription_id text,
  paystack_plan_code       text,
  status              text default 'active',  -- active | cancelled | paused | past_due
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────────────────────────
create table if not exists payments (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  paystack_reference  text unique,
  amount              numeric(10,2) not null,
  currency            text default 'USD',
  status              text default 'pending',  -- pending | success | failed | refunded
  plan_id             text references plans(id),
  description         text,
  metadata            jsonb,
  created_at          timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- EMAIL_ACCOUNTS  (connected Gmail accounts)
-- ─────────────────────────────────────────────────────────────
create table if not exists email_accounts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  email           text not null,
  provider        text default 'gmail',
  access_token_enc  text,  -- encrypted server-side, never sent to client
  refresh_token_enc text,  -- encrypted server-side, never sent to client
  token_expiry    timestamptz,
  scopes          text[] default '{}',
  is_active       boolean default true,
  last_scanned_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(user_id, email)
);

-- ─────────────────────────────────────────────────────────────
-- RECEIPTS
-- ─────────────────────────────────────────────────────────────
create table if not exists receipts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  email_account_id uuid references email_accounts(id) on delete set null,
  merchant_name   text not null,
  merchant_logo_url text,
  amount          numeric(12,2) not null,
  currency        text default 'USD',
  purchase_date   date not null,
  category        text not null default 'Other',
  status          text default 'detected',  -- detected | verified | manual
  invoice_number  text,
  order_number    text,
  tax_amount      numeric(10,2),
  payment_method  text,
  notes           text,
  gmail_message_id text unique,
  raw_email_snippet text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- RECEIPT_ITEMS
-- ─────────────────────────────────────────────────────────────
create table if not exists receipt_items (
  id          uuid primary key default uuid_generate_v4(),
  receipt_id  uuid not null references receipts(id) on delete cascade,
  description text not null,
  quantity    int default 1,
  unit_price  numeric(10,2),
  total_price numeric(10,2),
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────────
create table if not exists subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  company_name    text not null,
  company_logo_url text,
  monthly_price   numeric(10,2) not null,
  yearly_price    numeric(10,2),
  billing_cycle   text default 'monthly',  -- monthly | yearly | quarterly
  renewal_date    date not null,
  status          text default 'active',   -- active | cancelled | paused | trial
  category        text not null default 'Other',
  reminder_enabled boolean default true,
  notes           text,
  detected_from_receipt_id uuid references receipts(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- RENEWALS
-- ─────────────────────────────────────────────────────────────
create table if not exists renewals (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  subscription_id     uuid not null references subscriptions(id) on delete cascade,
  amount              numeric(10,2) not null,
  renewal_date        date not null,
  status              text default 'upcoming',  -- upcoming | completed | missed | cancelled
  reminder_sent_at    timestamptz,
  created_at          timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- WARRANTIES
-- ─────────────────────────────────────────────────────────────
create table if not exists warranties (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  receipt_id          uuid references receipts(id) on delete set null,
  product_name        text not null,
  merchant_name       text,
  purchase_date       date not null,
  warranty_end_date   date not null,
  reminder_enabled    boolean default true,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null,  -- renewal_reminder | warranty_expiry | trial_ending | return_window
  title       text not null,
  body        text not null,
  is_read     boolean default false,
  sent_via    text[],         -- email | browser
  reference_id uuid,          -- subscription_id / warranty_id / etc
  reference_type text,
  scheduled_for timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- ACTIVITY_LOGS
-- ─────────────────────────────────────────────────────────────
create table if not exists activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null,
  description text not null,
  metadata    jsonb,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- FEEDBACK
-- ─────────────────────────────────────────────────────────────
create table if not exists feedback (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null,  -- feedback | feature_request | bug_report | support
  subject     text not null,
  body        text not null,
  status      text default 'open',  -- open | in_progress | resolved | closed
  priority    text default 'normal',
  admin_notes text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- AUDIT_LOGS  (admin)
-- ─────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

alter table profiles           enable row level security;
alter table email_accounts     enable row level security;
alter table receipts           enable row level security;
alter table receipt_items      enable row level security;
alter table subscriptions      enable row level security;
alter table renewals           enable row level security;
alter table warranties         enable row level security;
alter table notifications      enable row level security;
alter table activity_logs      enable row level security;
alter table user_subscriptions enable row level security;
alter table payments           enable row level security;
alter table feedback           enable row level security;
alter table audit_logs         enable row level security;

-- profiles
create policy "Users can view own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- email_accounts
create policy "Users see own email accounts"   on email_accounts for select using (auth.uid() = user_id);
create policy "Users insert own email accounts" on email_accounts for insert with check (auth.uid() = user_id);
create policy "Users update own email accounts" on email_accounts for update using (auth.uid() = user_id);
create policy "Users delete own email accounts" on email_accounts for delete using (auth.uid() = user_id);

-- receipts
create policy "Users see own receipts"    on receipts for select using (auth.uid() = user_id);
create policy "Users insert own receipts" on receipts for insert with check (auth.uid() = user_id);
create policy "Users update own receipts" on receipts for update using (auth.uid() = user_id);
create policy "Users delete own receipts" on receipts for delete using (auth.uid() = user_id);

-- receipt_items
create policy "Users see own receipt items" on receipt_items for select
  using (exists (select 1 from receipts r where r.id = receipt_id and r.user_id = auth.uid()));
create policy "Users insert own receipt items" on receipt_items for insert
  with check (exists (select 1 from receipts r where r.id = receipt_id and r.user_id = auth.uid()));
create policy "Users update own receipt items" on receipt_items for update
  using (exists (select 1 from receipts r where r.id = receipt_id and r.user_id = auth.uid()));
create policy "Users delete own receipt items" on receipt_items for delete
  using (exists (select 1 from receipts r where r.id = receipt_id and r.user_id = auth.uid()));

-- subscriptions
create policy "Users see own subscriptions"    on subscriptions for select using (auth.uid() = user_id);
create policy "Users insert own subscriptions" on subscriptions for insert with check (auth.uid() = user_id);
create policy "Users update own subscriptions" on subscriptions for update using (auth.uid() = user_id);
create policy "Users delete own subscriptions" on subscriptions for delete using (auth.uid() = user_id);

-- renewals
create policy "Users see own renewals"    on renewals for select using (auth.uid() = user_id);
create policy "Users insert own renewals" on renewals for insert with check (auth.uid() = user_id);
create policy "Users update own renewals" on renewals for update using (auth.uid() = user_id);
create policy "Users delete own renewals" on renewals for delete using (auth.uid() = user_id);

-- warranties
create policy "Users see own warranties"    on warranties for select using (auth.uid() = user_id);
create policy "Users insert own warranties" on warranties for insert with check (auth.uid() = user_id);
create policy "Users update own warranties" on warranties for update using (auth.uid() = user_id);
create policy "Users delete own warranties" on warranties for delete using (auth.uid() = user_id);

-- notifications
create policy "Users see own notifications"    on notifications for select using (auth.uid() = user_id);
create policy "Users update own notifications" on notifications for update using (auth.uid() = user_id);

-- activity_logs
create policy "Users see own activity" on activity_logs for select using (auth.uid() = user_id);

-- user_subscriptions
create policy "Users see own plan subscription" on user_subscriptions for select using (auth.uid() = user_id);

-- payments
create policy "Users see own payments" on payments for select using (auth.uid() = user_id);

-- feedback
create policy "Users see own feedback"    on feedback for select using (auth.uid() = user_id);
create policy "Users insert own feedback" on feedback for insert with check (auth.uid() = user_id);
create policy "Users update own feedback" on feedback for update using (auth.uid() = user_id);

-- audit_logs (admins only — via service role, no public RLS needed)
create policy "No direct access to audit logs" on audit_logs for select using (false);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_receipts_user_id        on receipts(user_id);
create index if not exists idx_receipts_purchase_date  on receipts(purchase_date desc);
create index if not exists idx_subscriptions_user_id   on subscriptions(user_id);
create index if not exists idx_subscriptions_renewal   on subscriptions(renewal_date);
create index if not exists idx_warranties_user_id      on warranties(user_id);
create index if not exists idx_warranties_end_date     on warranties(warranty_end_date);
create index if not exists idx_notifications_user_id   on notifications(user_id);
create index if not exists idx_activity_logs_user_id   on activity_logs(user_id);
create index if not exists idx_payments_user_id        on payments(user_id);
create index if not exists idx_feedback_user_id        on feedback(user_id);
create index if not exists idx_email_accounts_user_id  on email_accounts(user_id);
