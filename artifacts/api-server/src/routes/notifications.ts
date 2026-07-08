/**
 * Notifications Routes
 * Provides in-app notification read/management for the current user.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

// List notifications (newest first, last 50)
router.get('/api/notifications', requireAuth, async (req, res): Promise<void> => {
  const { limit: limitRaw = '50', unread_only = 'false' } = req.query as Record<string, string>;
  const limit = parseInt(limitRaw, 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    res.status(400).json({ error: 'limit must be an integer between 1 and 100' }); return;
  }

  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unread_only === 'true') query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// Unread count (lightweight poll)
router.get('/api/notifications/unread-count', requireAuth, async (req, res): Promise<void> => {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.userId)
    .eq('is_read', false);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ count: count ?? 0 });
});

// Mark a single notification as read
router.patch('/api/notifications/:id/read', requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', req.userId);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

// Mark ALL notifications as read
router.post('/api/notifications/mark-all-read', requireAuth, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', req.userId)
    .eq('is_read', false);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

// Delete a single notification
router.delete('/api/notifications/:id', requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', req.userId);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

export default router;
