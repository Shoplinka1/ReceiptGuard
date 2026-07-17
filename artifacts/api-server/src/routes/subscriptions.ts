import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

const FREE_SUB_LIMIT = 5;

/**
 * Map a DB row to the API shape.
 *
 * Column history: the subscriptions table originally had `company_name`; it was
 * renamed to `name` in the Phase 2 migration. We read both columns for backward
 * compatibility so that rows written before the migration still surface correctly.
 */
function mapSub(s: any) {
  const displayName: string | null = s.name ?? s.company_name ?? null;
  return {
    id: s.id,
    companyName: displayName,
    companyLogoUrl: s.company_logo_url ?? null,
    website: s.website ?? null,
    monthlyPrice: Number(s.monthly_price),
    yearlyPrice: s.yearly_price ? Number(s.yearly_price) : null,
    billingCycle: s.billing_cycle ?? 'monthly',
    renewalDate: s.renewal_date,
    status: s.status ?? 'active',
    category: s.category ?? null,
    reminderEnabled: s.reminder_enabled ?? true,
    notes: s.notes ?? null,
    currency: s.currency ?? null,
    createdAt: s.created_at,
  };
}

router.get('/api/subscriptions', requireAuth, async (req, res): Promise<void> => {
  const {
    search,
    status,
    category,
    billingCycle,
    sortBy = 'renewal_date',
    sortDir = 'asc',
  } = req.query as Record<string, string>;

  let query = supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', req.userId);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (billingCycle) query = query.eq('billing_cycle', billingCycle);
  query = query.order(sortBy as any, { ascending: sortDir === 'asc' });

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: 'Failed to load subscriptions. Please try again.' });
    return;
  }

  let items = (data ?? []).map(mapSub);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(s => (s.companyName ?? '').toLowerCase().includes(q));
  }
  res.json(items);
});

router.post('/api/subscriptions', requireAuth, async (req, res): Promise<void> => {
  const {
    companyName, companyLogoUrl, website,
    monthlyPrice, yearlyPrice, billingCycle,
    renewalDate, status, category, reminderEnabled, notes, currency,
  } = req.body;

  if (!companyName || monthlyPrice == null || !renewalDate || !category) {
    res.status(400).json({
      error: 'companyName, monthlyPrice, renewalDate, and category are required',
    });
    return;
  }

  // Free plan limit
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('plan_id').eq('id', req.userId).single();
  if (profile?.plan_id !== 'pro') {
    const { count } = await supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId).eq('status', 'active');
    if ((count ?? 0) >= FREE_SUB_LIMIT) {
      res.status(403).json({
        error: `You've reached the Free plan limit of ${FREE_SUB_LIMIT} active subscriptions. Upgrade to Pro for unlimited subscription tracking.`,
        limitReached: true, limit: FREE_SUB_LIMIT, feature: 'subscriptions',
      });
      return;
    }
  }

  const { data, error } = await supabaseAdmin.from('subscriptions').insert({
    user_id: req.userId,
    // Write to `name` (current column); also set company_name for any old indexes/constraints
    name: companyName,
    company_name: companyName,
    company_logo_url: companyLogoUrl ?? null,
    website: website ?? null,
    monthly_price: monthlyPrice,
    yearly_price: yearlyPrice ?? null,
    billing_cycle: billingCycle ?? 'monthly',
    renewal_date: renewalDate,
    status: status ?? 'active',
    category,
    reminder_enabled: reminderEnabled ?? true,
    notes: notes ?? null,
    currency: currency ?? null,
  }).select().single();

  if (error) {
    res.status(500).json({ error: 'Failed to save subscription. Please try again.' });
    return;
  }
  res.status(201).json(mapSub(data));
});

router.get('/api/subscriptions/breakdown', requireAuth, async (req, res): Promise<void> => {
  const { data: subs } = await supabaseAdmin
    .from('subscriptions').select('*')
    .eq('user_id', req.userId).eq('status', 'active');

  const monthly = (subs ?? []).filter(s => s.billing_cycle === 'monthly');
  const yearly  = (subs ?? []).filter(s => s.billing_cycle === 'yearly');
  const monthlyTotal = monthly.reduce((sum, s) => sum + Number(s.monthly_price), 0);
  const yearlyTotal  = yearly.reduce(
    (sum, s) => sum + (s.yearly_price ? Number(s.yearly_price) : Number(s.monthly_price) * 12),
    0,
  );

  const catMap = new Map<string, { total: number; count: number }>();
  for (const s of subs ?? []) {
    const price = s.billing_cycle === 'yearly' && s.yearly_price
      ? Number(s.yearly_price) / 12
      : Number(s.monthly_price);
    const ex = catMap.get(s.category);
    if (ex) { ex.total += price; ex.count++; }
    else catMap.set(s.category, { total: price, count: 1 });
  }

  res.json({
    monthlyCount: monthly.length,
    yearlyCount: yearly.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyTotal: Math.round(yearlyTotal * 100) / 100,
    grandMonthlyEquivalent: Math.round((monthlyTotal + yearlyTotal / 12) * 100) / 100,
    categoryBreakdown: Array.from(catMap.entries()).map(([category, v]) => ({
      category, total: Math.round(v.total * 100) / 100, count: v.count,
    })),
  });
});

router.get('/api/subscriptions/:id', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('subscriptions').select('*')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Subscription not found' }); return; }
  res.json(mapSub(data));
});

router.patch('/api/subscriptions/:id', requireAuth, async (req, res): Promise<void> => {
  const {
    companyName, monthlyPrice, yearlyPrice, billingCycle,
    renewalDate, status, category, reminderEnabled, notes, website, currency,
  } = req.body;

  const updates: Record<string, any> = {};
  if (companyName !== undefined) { updates.name = companyName; updates.company_name = companyName; }
  if (monthlyPrice !== undefined) updates.monthly_price = monthlyPrice;
  if (yearlyPrice !== undefined) updates.yearly_price = yearlyPrice;
  if (billingCycle !== undefined) updates.billing_cycle = billingCycle;
  if (renewalDate !== undefined) updates.renewal_date = renewalDate;
  if (status !== undefined) updates.status = status;
  if (category !== undefined) updates.category = category;
  if (reminderEnabled !== undefined) updates.reminder_enabled = reminderEnabled;
  if (notes !== undefined) updates.notes = notes;
  if (website !== undefined) updates.website = website;
  if (currency !== undefined) updates.currency = currency;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('subscriptions').update(updates)
    .eq('id', req.params.id).eq('user_id', req.userId)
    .select().single();

  if (error || !data) { res.status(404).json({ error: 'Subscription not found' }); return; }
  res.json(mapSub(data));
});

router.delete('/api/subscriptions/:id', requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('subscriptions').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) { res.status(500).json({ error: 'Failed to delete subscription. Please try again.' }); return; }
  res.sendStatus(204);
});

export default router;
