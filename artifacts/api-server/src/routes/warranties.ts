import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { FREE_WARRANTY_LIMIT } from './gmail';

const router: IRouter = Router();

function getStatus(endDate: string): 'active' | 'expiring_soon' | 'expired' {
  const today = new Date().toISOString().split('T')[0];
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  if (endDate < today) return 'expired';
  if (endDate <= soon) return 'expiring_soon';
  return 'active';
}

function mapWarranty(w: any) {
  const daysRemaining = Math.ceil((new Date(w.warranty_end_date).getTime() - Date.now()) / 86400000);
  return {
    id: w.id, productName: w.product_name, merchantName: w.merchant_name ?? null,
    purchaseDate: w.purchase_date, warrantyEndDate: w.warranty_end_date,
    warrantyMonths: w.warranty_months ?? null,
    // true when the duration was guessed from product category rather than
    // read from the source email — the UI must label these "Estimated" and
    // never present them as a confirmed manufacturer warranty.
    isEstimated: w.is_estimated ?? false,
    daysRemaining, status: getStatus(w.warranty_end_date),
    reminderEnabled: w.reminder_enabled, notes: w.notes ?? null, createdAt: w.created_at,
  };
}

router.get('/api/warranties', requireAuth, async (req, res): Promise<void> => {
  const { search, status } = req.query as Record<string, string>;

  const { data, error } = await supabaseAdmin
    .from('warranties').select('*').eq('user_id', req.userId)
    .order('warranty_end_date', { ascending: true });
  if (error) { res.status(500).json({ error: 'Failed to load warranties. Please try again.' }); return; }

  let items = (data ?? []).map(mapWarranty);
  if (search) items = items.filter(w =>
    w.productName.toLowerCase().includes(search.toLowerCase()) ||
    (w.merchantName ?? '').toLowerCase().includes(search.toLowerCase())
  );
  if (status) items = items.filter(w => w.status === status);
  res.json(items);
});

router.post('/api/warranties', requireAuth, async (req, res): Promise<void> => {
  const { productName, merchantName, purchaseDate, warrantyEndDate, reminderEnabled, notes } = req.body;
  if (!productName || !purchaseDate || !warrantyEndDate) {
    res.status(400).json({ error: 'productName, purchaseDate, and warrantyEndDate are required' });
    return;
  }

  // Free plan: max 5 warranties
  const { data: profile } = await supabaseAdmin.from('profiles').select('plan_id').eq('id', req.userId).single();
  if (profile?.plan_id !== 'pro') {
    const { count } = await supabaseAdmin.from('warranties')
      .select('*', { count: 'exact', head: true }).eq('user_id', req.userId);
    if ((count ?? 0) >= FREE_WARRANTY_LIMIT) {
      res.status(403).json({
        error: `Free plan allows up to ${FREE_WARRANTY_LIMIT} warranties. Upgrade to Pro for unlimited warranty tracking.`,
        limitReached: true,
        limit: FREE_WARRANTY_LIMIT,
        feature: 'warranties',
      });
      return;
    }
  }

  const { data, error } = await supabaseAdmin.from('warranties').insert({
    user_id: req.userId, product_name: productName, merchant_name: merchantName ?? null,
    purchase_date: purchaseDate, warranty_end_date: warrantyEndDate,
    reminder_enabled: reminderEnabled ?? true, notes: notes ?? null,
  }).select().single();

  if (error) { res.status(500).json({ error: 'Failed to save warranty. Please try again.' }); return; }
  res.status(201).json(mapWarranty(data));
});

router.get('/api/warranties/:id', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('warranties').select('*').eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Warranty not found' }); return; }
  res.json(mapWarranty(data));
});

router.patch('/api/warranties/:id', requireAuth, async (req, res): Promise<void> => {
  const { productName, merchantName, warrantyEndDate, warrantyMonths, reminderEnabled, notes } = req.body;

  if (warrantyMonths !== undefined) {
    if (!Number.isInteger(warrantyMonths) || warrantyMonths < 1 || warrantyMonths > 360) {
      res.status(400).json({ error: 'warrantyMonths must be a whole number of months between 1 and 360 (30 years).' });
      return;
    }
  }

  const updates: Record<string, any> = {};
  if (productName) updates.product_name = productName;
  if (merchantName !== undefined) updates.merchant_name = merchantName;
  if (warrantyEndDate) updates.warranty_end_date = warrantyEndDate;
  if (warrantyMonths !== undefined) updates.warranty_months = warrantyMonths;
  if (reminderEnabled !== undefined) updates.reminder_enabled = reminderEnabled;
  if (notes !== undefined) updates.notes = notes;
  // Any manual edit to the length or expiry date means it's no longer just
  // a category-based guess — clear the estimated flag so the UI stops
  // labeling a user-confirmed warranty as "Estimated".
  if (warrantyEndDate || warrantyMonths !== undefined) updates.is_estimated = false;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('warranties').update(updates).eq('id', req.params.id).eq('user_id', req.userId).select().single();
  if (error || !data) { res.status(404).json({ error: 'Warranty not found' }); return; }
  res.json(mapWarranty(data));
});

router.delete('/api/warranties/:id', requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('warranties').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) { res.status(500).json({ error: 'Failed to delete warranty. Please try again.' }); return; }
  res.sendStatus(204);
});

export default router;
