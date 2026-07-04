import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

function mapReceipt(r: any) {
  return {
    id: r.id, merchantName: r.merchant_name, merchantLogoUrl: r.merchant_logo_url ?? null,
    amount: Number(r.amount), currency: r.currency, purchaseDate: r.purchase_date,
    category: r.category, status: r.status, invoiceNumber: r.invoice_number ?? null,
    notes: r.notes ?? null, createdAt: r.created_at,
  };
}

router.get('/api/receipts', requireAuth, async (req, res): Promise<void> => {
  const { search, category, dateFrom, dateTo, minAmount, maxAmount, page = '1', pageSize = '20', merchant } = req.query as Record<string, string>;

  let query = supabaseAdmin.from('receipts').select('*', { count: 'exact' }).eq('user_id', req.userId).order('purchase_date', { ascending: false });

  if (merchant) query = query.ilike('merchant_name', `%${merchant}%`);
  if (category) query = query.eq('category', category);
  if (dateFrom) query = query.gte('purchase_date', dateFrom);
  if (dateTo) query = query.lte('purchase_date', dateTo);
  if (minAmount) query = query.gte('amount', minAmount);
  if (maxAmount) query = query.lte('amount', maxAmount);

  const pageNum = parseInt(page) || 1;
  const size = parseInt(pageSize) || 20;
  query = query.range((pageNum - 1) * size, pageNum * size - 1);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  let items = (data ?? []).map(mapReceipt);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(r => r.merchantName.toLowerCase().includes(s) || r.category.toLowerCase().includes(s) || (r.invoiceNumber ?? '').toLowerCase().includes(s));
  }

  res.json({ items, total: count ?? 0, page: pageNum, pageSize: size });
});

router.post('/api/receipts', requireAuth, async (req, res): Promise<void> => {
  const { merchantName, merchantLogoUrl, amount, currency, purchaseDate, category, invoiceNumber, notes } = req.body;
  if (!merchantName || !amount || !purchaseDate || !category) { res.status(400).json({ error: 'merchantName, amount, purchaseDate, and category are required' }); return; }

  const { data, error } = await supabaseAdmin.from('receipts').insert({
    user_id: req.userId, merchant_name: merchantName, merchant_logo_url: merchantLogoUrl ?? null,
    amount, currency: currency ?? 'USD', purchase_date: purchaseDate, category, status: 'manual',
    invoice_number: invoiceNumber ?? null, notes: notes ?? null,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(mapReceipt(data));
});

router.get('/api/receipts/:id', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin.from('receipts').select('*').eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Receipt not found' }); return; }
  res.json(mapReceipt(data));
});

router.patch('/api/receipts/:id', requireAuth, async (req, res): Promise<void> => {
  const { merchantName, amount, purchaseDate, category, invoiceNumber, notes } = req.body;
  const updates: Record<string, any> = {};
  if (merchantName) updates.merchant_name = merchantName;
  if (amount) updates.amount = amount;
  if (purchaseDate) updates.purchase_date = purchaseDate;
  if (category) updates.category = category;
  if (invoiceNumber !== undefined) updates.invoice_number = invoiceNumber;
  if (notes !== undefined) updates.notes = notes;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin.from('receipts').update(updates).eq('id', req.params.id).eq('user_id', req.userId).select().single();
  if (error || !data) { res.status(404).json({ error: 'Receipt not found' }); return; }
  res.json(mapReceipt(data));
});

router.delete('/api/receipts/:id', requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin.from('receipts').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

export default router;
