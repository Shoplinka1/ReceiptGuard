import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

router.get('/api/merchants', requireAuth, async (req, res): Promise<void> => {
  const { data: receipts } = await supabaseAdmin.from('receipts').select('merchant_name, merchant_logo_url, amount, purchase_date').eq('user_id', req.userId);
  const map = new Map<string, { logo: string | null; total: number; count: number; last: string }>();
  for (const r of receipts ?? []) {
    const ex = map.get(r.merchant_name);
    if (ex) { ex.total += Number(r.amount); ex.count++; if (r.purchase_date > ex.last) ex.last = r.purchase_date; }
    else map.set(r.merchant_name, { logo: r.merchant_logo_url, total: Number(r.amount), count: 1, last: r.purchase_date });
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
