/**
 * User Feedback Routes
 * Handles feedback, feature requests, bug reports, and support tickets.
 * Stores everything in Supabase. Admins view via /api/admin/feedback.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

router.post('/api/feedback', requireAuth, async (req, res): Promise<void> => {
  const { type, subject, body } = req.body as { type: string; subject: string; body: string };

  const validTypes = ['feedback', 'feature_request', 'bug_report', 'support'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: 'Invalid feedback type' });
    return;
  }
  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'Subject and body are required' });
    return;
  }

  const { data, error } = await supabaseAdmin.from('feedback').insert({
    user_id: req.userId,
    type,
    subject: subject.trim(),
    body: body.trim(),
    status: 'open',
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from('activity_logs').insert({
    user_id: req.userId,
    type: `feedback_submitted`,
    description: `${type.replace('_', ' ')} submitted: ${subject}`,
    metadata: { feedbackId: data.id, type },
  });

  res.status(201).json(data);
});

router.get('/api/feedback', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('feedback')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

export default router;
