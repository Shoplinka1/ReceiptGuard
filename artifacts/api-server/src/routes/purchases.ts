import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

function mapPurchase(p: any, docCount = 0, hasWarranty = false, hasReturn = false) {
  return {
    id: p.id,
    merchantName: p.merchant_name,
    amount: Number(p.amount),
    currency: p.currency ?? 'USD',
    purchaseDate: p.purchase_date,
    category: p.category,
    notes: p.notes ?? null,
    receiptId: p.receipt_id ?? null,
    documentCount: docCount,
    hasWarranty,
    hasReturn,
    createdAt: p.created_at,
  };
}

router.get('/api/purchases', requireAuth, async (req, res): Promise<void> => {
  const { search, category, merchant, dateFrom, dateTo, minAmount, maxAmount, page = '1', pageSize = '20' } = req.query as Record<string, string>;

  let query = supabaseAdmin
    .from('purchases')
    .select('*', { count: 'exact' })
    .eq('user_id', req.userId)
    .order('purchase_date', { ascending: false });

  if (category) query = query.eq('category', category);
  if (merchant) query = query.ilike('merchant_name', `%${merchant}%`);
  if (dateFrom) query = query.gte('purchase_date', dateFrom);
  if (dateTo) query = query.lte('purchase_date', dateTo);
  if (minAmount) query = query.gte('amount', minAmount);
  if (maxAmount) query = query.lte('amount', maxAmount);

  const pageNum = parseInt(page) || 1;
  const size = parseInt(pageSize) || 20;
  query = query.range((pageNum - 1) * size, pageNum * size - 1);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: 'Failed to load purchases. Please try again.' }); return; }

  let items = data ?? [];
  if (search) {
    const s = search.toLowerCase();
    items = items.filter((p: any) =>
      p.merchant_name.toLowerCase().includes(s) ||
      (p.category ?? '').toLowerCase().includes(s) ||
      (p.notes ?? '').toLowerCase().includes(s)
    );
  }

  // Enrich with document counts, warranty presence, return presence
  const ids = items.map((p: any) => p.id);
  const [{ data: docs }, { data: warranties }, { data: returns }] = await Promise.all([
    ids.length ? supabaseAdmin.from('documents').select('purchase_id').in('purchase_id', ids) : { data: [] },
    ids.length ? supabaseAdmin.from('warranties').select('purchase_id').in('purchase_id', ids) : { data: [] },
    ids.length ? supabaseAdmin.from('returns').select('purchase_id').in('purchase_id', ids) : { data: [] },
  ]);

  const docCountMap = new Map<number, number>();
  for (const d of docs ?? []) {
    docCountMap.set(d.purchase_id, (docCountMap.get(d.purchase_id) ?? 0) + 1);
  }
  const warrantySet = new Set((warranties ?? []).map((w: any) => w.purchase_id));
  const returnSet = new Set((returns ?? []).map((r: any) => r.purchase_id));

  res.json({
    items: items.map((p: any) =>
      mapPurchase(p, docCountMap.get(p.id) ?? 0, warrantySet.has(p.id), returnSet.has(p.id))
    ),
    total: count ?? 0,
    page: pageNum,
    pageSize: size,
  });
});

router.post('/api/purchases', requireAuth, async (req, res): Promise<void> => {
  const { merchantName, amount, currency, purchaseDate, category, notes, receiptId } = req.body;
  if (!merchantName || amount == null || !purchaseDate || !category) {
    res.status(400).json({ error: 'merchantName, amount, purchaseDate, and category are required' });
    return;
  }

  const { data, error } = await supabaseAdmin.from('purchases').insert({
    user_id: req.userId,
    merchant_name: merchantName,
    amount,
    currency: currency ?? 'USD',
    purchase_date: purchaseDate,
    category,
    notes: notes ?? null,
    receipt_id: receiptId ?? null,
  }).select().single();

  if (error) { res.status(500).json({ error: 'Failed to save purchase. Please try again.' }); return; }

  // Log activity
  void supabaseAdmin.from('activity_logs').insert({
    user_id: req.userId, type: 'purchase_added',
    description: `New purchase added: ${merchantName} — $${Number(amount).toFixed(2)}`,
  }).then(undefined, () => {});

  res.status(201).json(mapPurchase(data));
});

router.get('/api/purchases/:id', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('purchases').select('*').eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Purchase not found' }); return; }

  const [{ data: docs }, { data: warranties }, { data: returns }] = await Promise.all([
    supabaseAdmin.from('documents').select('id').eq('purchase_id', req.params.id),
    supabaseAdmin.from('warranties').select('id').eq('purchase_id', req.params.id),
    supabaseAdmin.from('returns').select('id').eq('purchase_id', req.params.id),
  ]);
  res.json(mapPurchase(data, (docs ?? []).length, (warranties ?? []).length > 0, (returns ?? []).length > 0));
});

router.patch('/api/purchases/:id', requireAuth, async (req, res): Promise<void> => {
  const { merchantName, amount, purchaseDate, category, notes, receiptId } = req.body;
  const updates: Record<string, any> = {};
  if (merchantName) updates.merchant_name = merchantName;
  if (amount != null) updates.amount = amount;
  if (purchaseDate) updates.purchase_date = purchaseDate;
  if (category) updates.category = category;
  if (notes !== undefined) updates.notes = notes;
  if (receiptId !== undefined) updates.receipt_id = receiptId;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('purchases').update(updates).eq('id', req.params.id).eq('user_id', req.userId).select().single();
  if (error || !data) { res.status(404).json({ error: 'Purchase not found' }); return; }
  res.json(mapPurchase(data));
});

router.delete('/api/purchases/:id', requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('purchases').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) { res.status(500).json({ error: 'Failed to delete purchase. Please try again.' }); return; }
  res.sendStatus(204);
});

export default router;
