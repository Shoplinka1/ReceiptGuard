import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

function mapSub(s: any) {
  return {
    id: s.id, companyName: s.company_name, companyLogoUrl: s.company_logo_url ?? null,
    monthlyPrice: Number(s.monthly_price), yearlyPrice: s.yearly_price ? Number(s.yearly_price) : null,
    billingCycle: s.billing_cycle, renewalDate: s.renewal_date, status: s.status,
    category: s.category, reminderEnabled: s.reminder_enabled, notes: s.notes ?? null,
    createdAt: s.created_at,
  };
}

router.get('/api/subscriptions', requireAuth, async (req, res): Promise<void> => {
  const { search, status, category, billingCycle, sortBy = 'renewal_date', sortDir = 'asc' } = req.query as Record<string, string>;

  let query = supabaseAdmin.from('subscriptions').select('*').eq('user_id', req.userId);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (billingCycle) query = query.eq('billing_cycle', billingCycle);
  query = query.order(sortBy as any, { ascending: sortDir === 'asc' });

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  let items = (data ?? []).map(mapSub);
  if (search) items = items.filter(s => s.companyName.toLowerCase().includes(search.toLowerCase()));
  res.json(items);
});

router.post('/api/subscriptions', requireAuth, async (req, res): Promise<void> => {
  const { companyName, companyLogoUrl, monthlyPrice, yearlyPrice, billingCycle, renewalDate, status, category, reminderEnabled, notes } = req.body;
  if (!companyName || !monthlyPrice || !renewalDate || !category) { res.status(400).json({ error: 'companyName, monthlyPrice, renewalDate, and category are required' }); return; }

  const { data, error } = await supabaseAdmin.from('subscriptions').insert({
    user_id: req.userId, company_name: companyName, company_logo_url: companyLogoUrl ?? null,
    monthly_price: monthlyPrice, yearly_price: yearlyPrice ?? null, billing_cycle: billingCycle ?? 'monthly',
    renewal_date: renewalDate, status: status ?? 'active', category,
    reminder_enabled: reminderEnabled ?? true, notes: notes ?? null,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(mapSub(data));
});

router.get('/api/subscriptions/breakdown', requireAuth, async (req, res): Promise<void> => {
  const { data: subs } = await supabaseAdmin.from('subscriptions').select('*').eq('user_id', req.userId).eq('status', 'active');
  const monthly = (subs ?? []).filter(s => s.billing_cycle === 'monthly');
  const yearly = (subs ?? []).filter(s => s.billing_cycle === 'yearly');
  const monthlyTotal = monthly.reduce((sum, s) => sum + Number(s.monthly_price), 0);
  const yearlyTotal = yearly.reduce((sum, s) => sum + (s.yearly_price ? Number(s.yearly_price) : Number(s.monthly_price) * 12), 0);
  const catMap = new Map<string, { total: number; count: number }>();
  for (const s of subs ?? []) {
    const price = s.billing_cycle === 'yearly' && s.yearly_price ? Number(s.yearly_price) / 12 : Number(s.monthly_price);
    const ex = catMap.get(s.category);
    if (ex) { ex.total += price; ex.count++; } else catMap.set(s.category, { total: price, count: 1 });
  }
  res.json({
    monthlyCount: monthly.length, yearlyCount: yearly.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100, yearlyTotal: Math.round(yearlyTotal * 100) / 100,
    grandMonthlyEquivalent: Math.round((monthlyTotal + yearlyTotal / 12) * 100) / 100,
    categoryBreakdown: Array.from(catMap.entries()).map(([category, v]) => ({ category, total: Math.round(v.total * 100) / 100, count: v.count })),
  });
});

router.get('/api/subscriptions/:id', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin.from('subscriptions').select('*').eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Subscription not found' }); return; }
  res.json(mapSub(data));
});

router.patch('/api/subscriptions/:id', requireAuth, async (req, res): Promise<void> => {
  const { companyName, monthlyPrice, yearlyPrice, billingCycle, renewalDate, status, category, reminderEnabled, notes } = req.body;
  const updates: Record<string, any> = {};
  if (companyName) updates.company_name = companyName;
  if (monthlyPrice) updates.monthly_price = monthlyPrice;
  if (yearlyPrice !== undefined) updates.yearly_price = yearlyPrice;
  if (billingCycle) updates.billing_cycle = billingCycle;
  if (renewalDate) updates.renewal_date = renewalDate;
  if (status) updates.status = status;
  if (category) updates.category = category;
  if (reminderEnabled !== undefined) updates.reminder_enabled = reminderEnabled;
  if (notes !== undefined) updates.notes = notes;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin.from('subscriptions').update(updates).eq('id', req.params.id).eq('user_id', req.userId).select().single();
  if (error || !data) { res.status(404).json({ error: 'Subscription not found' }); return; }
  res.json(mapSub(data));
});

router.delete('/api/subscriptions/:id', requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin.from('subscriptions').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

export default router;
