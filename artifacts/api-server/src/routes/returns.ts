import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

function mapReturn(r: any) {
  return {
    id: r.id,
    receiptId: r.receipt_id ?? null,
    merchantName: r.merchant_name,
    amount: r.amount ? Number(r.amount) : null,
    currency: r.currency ?? 'USD',
    reason: r.reason ?? null,
    status: r.status ?? 'open',          // open | in_progress | completed | denied
    initiatedDate: r.initiated_date,
    resolvedDate: r.resolved_date ?? null,
    trackingNumber: r.tracking_number ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// List
router.get('/api/returns', requireAuth, async (req, res): Promise<void> => {
  const { status, search } = req.query as Record<string, string>;

  let query = supabaseAdmin
    .from('returns')
    .select('*')
    .eq('user_id', req.userId)
    .order('initiated_date', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: 'Failed to load returns.' }); return; }

  let items = (data ?? []).map(mapReturn);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(r => r.merchantName.toLowerCase().includes(s) || (r.reason ?? '').toLowerCase().includes(s));
  }
  res.json(items);
});

// Create
router.post('/api/returns', requireAuth, async (req, res): Promise<void> => {
  const { merchantName, receiptId, amount, currency, reason, status, initiatedDate, trackingNumber, notes } = req.body;

  if (!merchantName) {
    res.status(400).json({ error: 'merchantName is required' });
    return;
  }

  const { data, error } = await supabaseAdmin.from('returns').insert({
    user_id: req.userId,
    receipt_id: receiptId ?? null,
    merchant_name: merchantName,
    amount: amount ?? null,
    currency: currency ?? 'USD',
    reason: reason ?? null,
    status: status ?? 'open',
    initiated_date: initiatedDate ?? new Date().toISOString().split('T')[0],
    tracking_number: trackingNumber ?? null,
    notes: notes ?? null,
  }).select().single();

  if (error) { res.status(500).json({ error: 'Failed to create return.' }); return; }
  res.status(201).json(mapReturn(data));
});

// Get single
router.get('/api/returns/:id', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('returns').select('*')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Return not found' }); return; }
  res.json(mapReturn(data));
});

// Update
router.patch('/api/returns/:id', requireAuth, async (req, res): Promise<void> => {
  const { merchantName, amount, currency, reason, status, initiatedDate, resolvedDate, trackingNumber, notes } = req.body;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (merchantName !== undefined) updates.merchant_name = merchantName;
  if (amount !== undefined) updates.amount = amount;
  if (currency !== undefined) updates.currency = currency;
  if (reason !== undefined) updates.reason = reason;
  if (status !== undefined) updates.status = status;
  if (initiatedDate !== undefined) updates.initiated_date = initiatedDate;
  if (resolvedDate !== undefined) updates.resolved_date = resolvedDate;
  if (trackingNumber !== undefined) updates.tracking_number = trackingNumber;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabaseAdmin
    .from('returns').update(updates)
    .eq('id', req.params.id).eq('user_id', req.userId)
    .select().single();
  if (error || !data) { res.status(404).json({ error: 'Return not found' }); return; }
  res.json(mapReturn(data));
});

// Delete
router.delete('/api/returns/:id', requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('returns').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) { res.status(500).json({ error: 'Failed to delete return.' }); return; }
  res.sendStatus(204);
});

export default router;
