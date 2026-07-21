-- ReceiptGuard Phase 3 Migration
-- Adds: purchases, documents, returns tables
-- Run in Supabase SQL Editor

-- ─── Purchases ────────────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  merchant_name text not null,
  amount       numeric(12,2) not null,
  currency     text not null default 'USD',
  purchase_date date not null,
  category     text not null,
  notes        text,
  receipt_id   bigint references public.receipts(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists purchases_user_id_idx on public.purchases(user_id);
create index if not exists purchases_purchase_date_idx on public.purchases(purchase_date);

alter table public.purchases enable row level security;

drop policy if exists "Users can manage own purchases" on public.purchases;
create policy "Users can manage own purchases"
  on public.purchases for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Documents ────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  file_url     text not null,
  file_type    text not null check (file_type in ('image', 'pdf', 'other')),
  mime_type    text,
  file_size    bigint not null default 0,
  purchase_id  bigint references public.purchases(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_purchase_id_idx on public.documents(purchase_id);

alter table public.documents enable row level security;

drop policy if exists "Users can manage own documents" on public.documents;
create policy "Users can manage own documents"
  on public.documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Returns ──────────────────────────────────────────────────────────────────
create table if not exists public.returns (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  merchant_name   text not null,
  item_name       text not null,
  amount          numeric(12,2) not null,
  currency        text not null default 'USD',
  return_deadline date not null,
  status          text not null default 'eligible'
                  check (status in ('eligible', 'initiated', 'completed', 'missed')),
  notes           text,
  purchase_id     bigint references public.purchases(id) on delete set null,
  receipt_id      bigint references public.receipts(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists returns_user_id_idx on public.returns(user_id);
create index if not exists returns_return_deadline_idx on public.returns(return_deadline);
create index if not exists returns_status_idx on public.returns(status);

alter table public.returns enable row level security;

drop policy if exists "Users can manage own returns" on public.returns;
create policy "Users can manage own returns"
  on public.returns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Add purchase_id / receipt_id columns to warranties ───────────────────────
alter table public.warranties add column if not exists purchase_id bigint references public.purchases(id) on delete set null;
alter table public.warranties add column if not exists receipt_id bigint references public.receipts(id) on delete set null;
alter table public.warranties add column if not exists warranty_length_months integer;

-- ─── Supabase Storage bucket for documents ────────────────────────────────────
-- Run this manually if the bucket doesn't already exist:
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', true)
-- on conflict (id) do nothing;

-- Storage RLS policies (run separately in Supabase Dashboard > Storage):
-- create policy "Users upload own documents"
--   on storage.objects for insert
--   with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "Users read own documents"
--   on storage.objects for select
--   using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "Users delete own documents"
--   on storage.objects for delete
--   using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─── Activity log: new types ──────────────────────────────────────────────────
-- The activity_logs.type column should accept new values. If it has a check constraint, run:
-- alter table public.activity_logs drop constraint if exists activity_logs_type_check;
-- (The backend inserts valid types; constraint is optional.)

select 'Phase 3 migration complete. Tables: purchases, documents, returns' as status;
