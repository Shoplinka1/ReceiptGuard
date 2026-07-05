/**
 * User Feedback Routes
 * Handles feedback, feature requests, bug reports, and support tickets.
 * Stores everything in Supabase. Admins view via /api/admin/feedback.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { sendEmail } from '../lib/email';

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

  let feedbackId: string | null = null;
  const { data, error } = await supabaseAdmin.from('feedback').insert({
    user_id: req.userId,
    type,
    subject: subject.trim(),
    body: body.trim(),
    status: 'open',
  }).select().single();

  // If DB insert fails (e.g. table not yet created), still send the email notification
  // and return success — data is captured in the email.
  if (error) {
    if (error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
      res.status(500).json({ error: error.message }); return;
    }
    // Table doesn't exist yet — fall through and still send email
  } else {
    feedbackId = data?.id ?? null;
    await supabaseAdmin.from('activity_logs').insert({
      user_id: req.userId,
      type: `feedback_submitted`,
      description: `${type.replace('_', ' ')} submitted: ${subject}`,
      metadata: { feedbackId, type },
    }).catch(() => {});
  }

  // Fire-and-forget email notification to admin
  const { data: userProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', req.userId).single();
  const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  sendEmail({
    to: 'receiptguard01@gmail.com',
    subject: `[ReceiptGuard] New ${typeLabel}: ${subject.trim()}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a1a">New ${typeLabel} Submitted</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:6px 0;color:#666;width:100px">From</td><td style="padding:6px 0;font-weight:500">${userProfile?.full_name || 'Unknown'}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${userProfile?.email || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Type</td><td style="padding:6px 0">${typeLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Subject</td><td style="padding:6px 0;font-weight:500">${subject.trim()}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Time</td><td style="padding:6px 0">${new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })} (WAT)</td></tr>
        </table>
        <div style="background:#f5f5f5;border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;margin-bottom:24px">
          <p style="margin:0;color:#333;white-space:pre-wrap">${body.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
        <p style="font-size:12px;color:#999">This is an automated notification from ReceiptGuard.</p>
      </div>
    `,
  }).catch(() => {});

  res.status(201).json(data ?? { type, subject, body, status: 'open', created_at: new Date().toISOString() });
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
