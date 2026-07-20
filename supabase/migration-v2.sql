-- ReceiptGuard 2.0 — Migration v2
-- Adds: returns table, documents table
-- Additive only — safe to run on top of schema.sql or migration.sql.
-- Paste into the Supabase SQL Editor and click Run.

-- ─── Returns ─────────────────────────────────────────────────────────────────
-- Tracks return requests linked to a purchase (receipt).
create table if not exists public.returns (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  receipt_id      uuid references public.receipts(id) on delete set null,
  merchant_name   text not null,
  amount          numeric(12,2),
  currency        text not null default 'USD',
  reason          text,
  status          text not null default 'open',   -- open | in_progress | completed | denied
  initiated_date  date not null default current_date,
  resolved_date   date,
  tracking_number text,
  notes           text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists returns_user_id_idx       on public.returns(user_id);
create index if not exists returns_status_idx        on public.returns(user_id, status);
create index if not exists returns_receipt_id_idx    on public.returns(receipt_id);
create index if not exists returns_initiated_date_idx on public.returns(user_id, initiated_date desc);

alter table public.returns enable row level security;

drop policy if exists "Users can view own returns"   on public.returns;
create policy "Users can view own returns"
  on public.returns for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own returns" on public.returns;
create policy "Users can insert own returns"
  on public.returns for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own returns" on public.returns;
create policy "Users can update own returns"
  on public.returns for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own returns" on public.returns;
create policy "Users can delete own returns"
  on public.returns for delete using (auth.uid() = user_id);

-- ─── Documents ───────────────────────────────────────────────────────────────
-- Stores uploaded files (PDFs, images) linked to purchases, warranties, returns.
create table if not exists public.documents (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  receipt_id      uuid references public.receipts(id)  on delete set null,
  warranty_id     uuid references public.warranties(id) on delete set null,
  return_id       uuid references public.returns(id)   on delete set null,
  name            text not null,
  file_url        text not null,
  file_type       text,                    -- 'pdf' | 'image' | 'other'
  file_size_bytes bigint,
  category        text not null default 'other',  -- receipt | warranty | return | invoice | other
  notes           text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists documents_user_id_idx    on public.documents(user_id);
create index if not exists documents_receipt_id_idx on public.documents(receipt_id);
create index if not exists documents_category_idx   on public.documents(user_id, category);
create index if not exists documents_created_at_idx on public.documents(user_id, created_at desc);

alter table public.documents enable row level security;

drop policy if exists "Users can view own documents"   on public.documents;
create policy "Users can view own documents"
  on public.documents for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own documents" on public.documents;
create policy "Users can update own documents"
  on public.documents for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents"
  on public.documents for delete using (auth.uid() = user_id);

-- ─── Dashboard summary: open_returns_count ────────────────────────────────────
-- No schema change needed — the API route queries returns WHERE status = 'open'.
-- This comment documents the intent so the API server route knows the contract.
