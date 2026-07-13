---
name: Supabase SQL migration idempotency
description: Dollar-quote tag matching and policy-creation guards needed for schema.sql/migration.sql to be safely rerunnable against Supabase.
---

Postgres `DO $tag$ ... END $tag$;` blocks require the open and close dollar-quote
tags to match exactly (`$$...$$` or `$body$...$body$`, etc.). A stray single
`$` (`DO $ ... END $;`) or mismatched tag is a hard syntax error, not a
warning — the whole statement fails to parse. When writing or editing
guarded migration blocks, grep for `DO \$` and confirm every open/close pair
uses the identical tag before asking the user to run the file.

`CREATE POLICY` has no `IF NOT EXISTS` clause in Postgres, and
`CREATE POLICY IF NOT EXISTS` is not valid syntax either. To make a schema
file safely rerunnable (e.g. after partial migrations or schema drift),
precede each `CREATE POLICY "name" ON public.table ...` with
`DROP POLICY IF EXISTS "name" ON public.table;`, or wrap it in a
`DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE ...) THEN ... END IF; END $$;`
guard.

**Why:** ReceiptGuard's `supabase/schema.sql` claimed to be idempotent but had
22 unguarded `CREATE POLICY` statements and two migration DO-blocks with
invalid single-`$` delimiters — it would have failed on any rerun, and the
migration file failed outright on first run. Caught via architect code
review, not by eye.

**How to apply:** Before telling a user to run any schema/migration SQL
file, grep it for `DO \$` and `create policy` and check tag-matching and
guard presence, not just first-run compilation.
