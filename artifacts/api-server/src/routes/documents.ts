import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

const FREE_DOC_LIMIT = 50; // generous free limit for documents

function mapDoc(d: any) {
  return {
    id: d.id,
    receiptId: d.receipt_id ?? null,
    warrantyId: d.warranty_id ?? null,
    returnId: d.return_id ?? null,
    name: d.name,
    fileUrl: d.file_url,
    fileType: d.file_type ?? null,       // 'pdf' | 'image' | 'other'
    fileSizeBytes: d.file_size_bytes ?? null,
    category: d.category ?? 'other',    // receipt | warranty | return | invoice | manual | other
    notes: d.notes ?? null,
    createdAt: d.created_at,
  };
}

// List
router.get('/api/documents', requireAuth, async (req, res): Promise<void> => {
  const { category, receiptId, warrantyId, search } = req.query as Record<string, string>;

  let query = supabaseAdmin
    .from('documents')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (category) query = query.eq('category', category);
  if (receiptId) query = query.eq('receipt_id', receiptId);
  if (warrantyId) query = query.eq('warranty_id', warrantyId);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: 'Failed to load documents.' }); return; }

  let items = (data ?? []).map(mapDoc);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(d => d.name.toLowerCase().includes(s));
  }
  res.json(items);
});

// Create (stores metadata; file is uploaded client-side to Supabase Storage)
router.post('/api/documents', requireAuth, async (req, res): Promise<void> => {
  const { name, fileUrl, fileType, fileSizeBytes, category, receiptId, warrantyId, returnId, notes } = req.body;

  if (!name || !fileUrl) {
    res.status(400).json({ error: 'name and fileUrl are required' });
    return;
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('plan_id').eq('id', req.userId).single();
  if (profile?.plan_id !== 'pro') {
    const { count } = await supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).eq('user_id', req.userId);
    if ((count ?? 0) >= FREE_DOC_LIMIT) {
      res.status(403).json({
        error: `Free plan allows up to ${FREE_DOC_LIMIT} documents. Upgrade to Pro for unlimited storage.`,
        limitReached: true,
        limit: FREE_DOC_LIMIT,
        feature: 'documents',
      });
      return;
    }
  }

  const { data, error } = await supabaseAdmin.from('documents').insert({
    user_id: req.userId,
    name,
    file_url: fileUrl,
    file_type: fileType ?? null,
    file_size_bytes: fileSizeBytes ?? null,
    category: category ?? 'other',
    receipt_id: receiptId ?? null,
    warranty_id: warrantyId ?? null,
    return_id: returnId ?? null,
    notes: notes ?? null,
  }).select().single();

  if (error) { res.status(500).json({ error: 'Failed to save document.' }); return; }
  res.status(201).json(mapDoc(data));
});

// Get single
router.get('/api/documents/:id', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('documents').select('*')
    .eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Document not found' }); return; }
  res.json(mapDoc(data));
});

// Update metadata
router.patch('/api/documents/:id', requireAuth, async (req, res): Promise<void> => {
  const { name, category, notes, receiptId, warrantyId, returnId } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (category !== undefined) updates.category = category;
  if (notes !== undefined) updates.notes = notes;
  if (receiptId !== undefined) updates.receipt_id = receiptId;
  if (warrantyId !== undefined) updates.warranty_id = warrantyId;
  if (returnId !== undefined) updates.return_id = returnId;

  const { data, error } = await supabaseAdmin
    .from('documents').update(updates)
    .eq('id', req.params.id).eq('user_id', req.userId)
    .select().single();
  if (error || !data) { res.status(404).json({ error: 'Document not found' }); return; }
  res.json(mapDoc(data));
});

// Delete (caller is responsible for removing from Storage)
router.delete('/api/documents/:id', requireAuth, async (req, res): Promise<void> => {
  // Return the file_url so caller can delete from Storage
  const { data: doc } = await supabaseAdmin
    .from('documents').select('file_url').eq('id', req.params.id).eq('user_id', req.userId).single();

  const { error } = await supabaseAdmin
    .from('documents').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) { res.status(500).json({ error: 'Failed to delete document.' }); return; }
  res.json({ deleted: true, fileUrl: doc?.file_url ?? null });
});

export default router;
