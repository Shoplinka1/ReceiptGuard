import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

const FREE_RECEIPT_LIMIT = 50;

function mapReceipt(r: any) {
  return {
    id: r.id,
    merchantName: r.merchant_name,
    merchantLogoUrl: r.merchant_logo_url ?? null,
    productName: r.product_name ?? null,
    amount: Number(r.amount),
    currency: r.currency,
    purchaseDate: r.purchase_date,
    category: r.category,
    status: r.status,
    invoiceNumber: r.invoice_number ?? null,
    orderId: r.order_id ?? null,
    paymentMethod: r.payment_method ?? null,
    serialNumber: r.serial_number ?? null,
    modelNumber: r.model_number ?? null,
    warrantyMonths: r.warranty_months ?? null,
    warrantyEndDate: r.warranty_end_date ?? null,
    returnDeadline: r.return_deadline ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────
router.get('/api/receipts', requireAuth, async (req, res): Promise<void> => {
  const {
    search, category, dateFrom, dateTo, minAmount, maxAmount,
    page = '1', pageSize = '20', merchant,
  } = req.query as Record<string, string>;

  let query = supabaseAdmin
    .from('receipts')
    .select('*', { count: 'exact' })
    .eq('user_id', req.userId)
    .order('purchase_date', { ascending: false });

  if (merchant)  query = query.ilike('merchant_name', `%${merchant}%`);
  if (category)  query = query.eq('category', category);
  if (dateFrom)  query = query.gte('purchase_date', dateFrom);
  if (dateTo)    query = query.lte('purchase_date', dateTo);
  if (minAmount) query = query.gte('amount', minAmount);
  if (maxAmount) query = query.lte('amount', maxAmount);

  const pageNum = Math.max(1, parseInt(page) || 1);
  const size    = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
  query = query.range((pageNum - 1) * size, pageNum * size - 1);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: 'Failed to load purchases. Please try again.' }); return; }

  let items = (data ?? []).map(mapReceipt);

  // Full-text search across multiple columns (done in JS after page fetch so
  // pagination still works — acceptable for current data volumes).
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(r =>
      (r.merchantName ?? '').toLowerCase().includes(s) ||
      (r.productName  ?? '').toLowerCase().includes(s) ||
      (r.category     ?? '').toLowerCase().includes(s) ||
      (r.invoiceNumber ?? '').toLowerCase().includes(s) ||
      (r.orderId       ?? '').toLowerCase().includes(s) ||
      (r.serialNumber  ?? '').toLowerCase().includes(s) ||
      (r.notes         ?? '').toLowerCase().includes(s)
    );
  }

  res.json({ items, total: count ?? 0, page: pageNum, pageSize: size });
});

// ─── Create ───────────────────────────────────────────────────────────────────
router.post('/api/receipts', requireAuth, async (req, res): Promise<void> => {
  const {
    merchantName, merchantLogoUrl,
    productName, amount, currency, purchaseDate, category,
    invoiceNumber, orderId, paymentMethod,
    serialNumber, modelNumber,
    warrantyMonths, returnDeadline,
    notes,
  } = req.body;

  if (!merchantName || !amount || !purchaseDate || !category) {
    res.status(400).json({ error: 'merchantName, amount, purchaseDate, and category are required' });
    return;
  }

  // Free plan: max 50 receipts
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('plan_id').eq('id', req.userId).single();
  if (profile?.plan_id !== 'pro') {
    const { count } = await supabaseAdmin
      .from('receipts').select('*', { count: 'exact', head: true }).eq('user_id', req.userId);
    if ((count ?? 0) >= FREE_RECEIPT_LIMIT) {
      res.status(403).json({
        error: `You've reached the Free plan limit of ${FREE_RECEIPT_LIMIT} purchases. Upgrade to Pro for unlimited storage.`,
        limitReached: true, limit: FREE_RECEIPT_LIMIT, feature: 'receipts',
      });
      return;
    }
  }

  const { data, error } = await supabaseAdmin.from('receipts').insert({
    user_id: req.userId,
    merchant_name: merchantName,
    merchant_logo_url: merchantLogoUrl ?? null,
    product_name: productName?.trim() || null,
    amount,
    currency: currency ?? 'USD',
    purchase_date: purchaseDate,
    category,
    status: 'manual',
    invoice_number: invoiceNumber?.trim() || null,
    order_id: orderId?.trim() || null,
    payment_method: paymentMethod?.trim() || null,
    serial_number: serialNumber?.trim() || null,
    model_number: modelNumber?.trim() || null,
    warranty_months: warrantyMonths ? Number(warrantyMonths) : null,
    return_deadline: returnDeadline || null,
    notes: notes?.trim() || null,
  }).select().single();

  if (error) { res.status(500).json({ error: 'Failed to save purchase. Please try again.' }); return; }
  res.status(201).json(mapReceipt(data));
});

// ─── Get single ───────────────────────────────────────────────────────────────
router.get('/api/receipts/:id', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('receipts').select('*')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Purchase not found' }); return; }
  res.json(mapReceipt(data));
});

// ─── Update ───────────────────────────────────────────────────────────────────
router.patch('/api/receipts/:id', requireAuth, async (req, res): Promise<void> => {
  const {
    merchantName, productName,
    amount, currency, purchaseDate, category,
    invoiceNumber, orderId, paymentMethod,
    serialNumber, modelNumber,
    warrantyMonths, returnDeadline,
    notes,
  } = req.body;

  const u: Record<string, any> = { updated_at: new Date().toISOString() };
  if (merchantName !== undefined)  u.merchant_name   = merchantName;
  if (productName  !== undefined)  u.product_name    = productName?.trim() || null;
  if (amount       !== undefined)  u.amount          = amount;
  if (currency     !== undefined)  u.currency        = currency;
  if (purchaseDate !== undefined)  u.purchase_date   = purchaseDate;
  if (category     !== undefined)  u.category        = category;
  if (invoiceNumber !== undefined) u.invoice_number  = invoiceNumber?.trim() || null;
  if (orderId       !== undefined) u.order_id        = orderId?.trim() || null;
  if (paymentMethod !== undefined) u.payment_method  = paymentMethod?.trim() || null;
  if (serialNumber  !== undefined) u.serial_number   = serialNumber?.trim() || null;
  if (modelNumber   !== undefined) u.model_number    = modelNumber?.trim() || null;
  if (warrantyMonths !== undefined) u.warranty_months = warrantyMonths ? Number(warrantyMonths) : null;
  if (returnDeadline !== undefined) u.return_deadline = returnDeadline || null;
  if (notes          !== undefined) u.notes           = notes?.trim() || null;

  const { data, error } = await supabaseAdmin
    .from('receipts').update(u)
    .eq('id', req.params.id).eq('user_id', req.userId)
    .select().single();
  if (error || !data) { res.status(404).json({ error: 'Purchase not found' }); return; }
  res.json(mapReceipt(data));
});

// ─── Delete ───────────────────────────────────────────────────────────────────
router.delete('/api/receipts/:id', requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('receipts').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) { res.status(500).json({ error: 'Failed to delete purchase. Please try again.' }); return; }
  res.sendStatus(204);
});

export default router;
