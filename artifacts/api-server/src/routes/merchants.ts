import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

// Same bounds as dashboard.ts's validAmount(): this endpoint previously had
// no filter at all, so a single corrupted receipt (e.g. a misparsed crypto
// exchange balance like "Bybit — $707,463.01") could dominate merchant
// totals here even after dashboard.ts's Top Merchants was fixed to exclude
// it — the two endpoints had silently diverged.
const validAmount = (v: unknown): number | null => {
  const n = Number(v);
  if (!isFinite(n) || n < 0.50 || n > 50_000) return null;
  return n;
};

router.get('/api/merchants', requireAuth, async (req, res): Promise<void> => {
  const { data: receipts } = await supabaseAdmin.from('receipts').select('merchant_name, merchant_logo_url, amount, purchase_date').eq('user_id', req.userId);
  const map = new Map<string, { logo: string | null; total: number; count: number; last: string }>();
  for (const r of receipts ?? []) {
    const amt = validAmount(r.amount);
    if (amt === null) continue;
    const ex = map.get(r.merchant_name);
    if (ex) { ex.total += amt; ex.count++; if (r.purchase_date > ex.last) ex.last = r.purchase_date; }
    else map.set(r.merchant_name, { logo: r.merchant_logo_url, total: amt, count: 1, last: r.purchase_date });
  }
  const result = Array.from(map.entries()).sort(([, a], [, b]) => b.total - a.total).map(([name, m], i) => ({
    id: i + 1, name, logoUrl: m.logo, purchaseCount: m.count,
    totalSpent: Math.round(m.total * 100) / 100, lastPurchaseDate: m.last || null,
  }));
  res.json(result);
});

router.get('/api/activity', requireAuth, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || '20'), 100);
  const { data, error } = await supabaseAdmin.from('activity_logs').select('*').eq('user_id', req.userId).order('created_at', { ascending: false }).limit(limit);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(l => ({
    id: l.id, type: l.type, description: l.description, metadata: l.metadata ?? null, createdAt: l.created_at,
  })));
});

export default router;
