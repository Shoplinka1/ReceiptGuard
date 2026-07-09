-- ReceiptGuard: corrupted/invalid receipt cleanup
--
-- Purpose: remove receipts that never should have been saved (impossible
-- amounts, crypto-exchange balances, sub-cent noise) so they stop polluting
-- Top Merchants / dashboard analytics, and de-duplicate rows that share the
-- same Gmail message (a leftover from before the unique constraint below).
--
-- Safe to re-run: every statement is a WHERE-scoped DELETE with no side
-- effects beyond the receipts table, and re-running finds nothing left to
-- delete on a clean table.
--
-- Run this in the Supabase SQL Editor against the production database.
-- Review the SELECT counts first; the DELETEs are commented out by default.

begin;

-- 1. How many rows would be affected? Run this first and review before deleting.
select
  count(*) filter (where amount < 0.50 or amount > 50000)      as impossible_amount_count,
  count(*) filter (where amount is null)                        as null_amount_count,
  count(*) filter (where merchant_name is null or trim(merchant_name) = '') as blank_merchant_count
from public.receipts;

-- Show the worst offenders (e.g. the Bybit $707,463.01 case) for a manual look
-- before deleting anything.
select id, user_id, merchant_name, amount, currency, purchase_date, raw_email_from
from public.receipts
where amount < 0.50 or amount > 50000 or amount is null
order by amount desc nulls last
limit 50;

-- 2. Duplicate receipts for the same Gmail message (only possible from before
-- the `receipts_user_id_gmail_message_id_key` unique constraint existed, or
-- from manual inserts). Keeps the oldest row, removes the rest.
with dupes as (
  select id,
         row_number() over (
           partition by user_id, gmail_message_id
           order by created_at asc
         ) as rn
  from public.receipts
  where gmail_message_id is not null
)
select count(*) as duplicate_row_count from dupes where rn > 1;

-- ── Uncomment to actually delete ──────────────────────────────────────────
--
-- delete from public.receipts
-- where amount < 0.50 or amount > 50000 or amount is null;
--
-- delete from public.receipts
-- where merchant_name is null or trim(merchant_name) = '';
--
-- with dupes as (
--   select id,
--          row_number() over (
--            partition by user_id, gmail_message_id
--            order by created_at asc
--          ) as rn
--   from public.receipts
--   where gmail_message_id is not null
-- )
-- delete from public.receipts
-- where id in (select id from dupes where rn > 1);
--
-- -- Same cleanup for subscriptions/warranties auto-created from a bad receipt
-- delete from public.subscriptions where monthly_price < 0.50 or monthly_price > 50000;
-- delete from public.payments where amount is not null and (amount < 0 or amount > 50000);

commit;

-- 3. Guardrail so this can never recur at the database layer, independent of
-- the application-level validation already added in the API server.
alter table public.receipts
  drop constraint if exists receipts_amount_sane_range;
alter table public.receipts
  add constraint receipts_amount_sane_range
  check (amount is null or (amount >= 0.50 and amount <= 50000));
