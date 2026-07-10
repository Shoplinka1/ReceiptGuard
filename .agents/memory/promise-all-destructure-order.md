---
name: Promise.all array/destructure order must move together
description: Inserting a new query into a large Promise.all([...]) array without moving its destructured variable to the matching position silently swaps unrelated results.
---

When adding new parallel queries to an existing large `const [ {a}, {b}, ... ] = await Promise.all([...])` block (e.g. `/api/admin/stats` in `admin.ts`), inserting the new query array entries at a different position than the matching destructured variables causes a silent, type-checked-but-wrong mismatch — later variables end up bound to the wrong query's result. No error is thrown; the bug only shows as wrong/zero values at runtime.

**Why:** TypeScript only checks structural shape per-slot, not semantic correspondence between array position and destructured name — a caught this exact bug (DAU/WAU/MAU counts swapped with newly-added warranty counts) that passed `tsc --noEmit` cleanly.

**How to apply:** When adding N new items to such a block, add them at the SAME relative position in both the destructuring list and the Promise.all array (e.g. always append at the very end of both, or insert immediately before/after a clearly-labeled anchor in both). After editing, do a side-by-side line-count/position check, not just a typecheck. A code-review pass with the diff is worth running specifically for this class of bug.
