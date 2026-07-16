/**
 * User Feedback Routes
 * Handles feedback, feature requests, bug reports, and support tickets.
 * Stores everything in Supabase. Admins view via /api/admin/feedback.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { sendEmail, EMAIL_SENDERS } from '../lib/email';
import { logger } from '../lib/logger';

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
  // Wrapped in try/catch (in addition to checking the returned `error`) so
  // that even a thrown exception (e.g. a network failure) can't skip the
  // email notification below — the admin should always be notified even if
  // persistence to Supabase is temporarily broken.
  let data: any = null;
  try {
    const insertResult = await supabaseAdmin.from('feedback').insert({
      user_id: req.userId,
      type,
      subject: subject.trim(),
      body: body.trim(),
      status: 'open',
    }).select().single();
    data = insertResult.data;
    const error = insertResult.error;
    if (error) {
      logger.error({ err: error, type, subject }, '[Feedback] DB insert failed — continuing to send email notification');
    } else {
      feedbackId = data?.id ?? null;
      supabaseAdmin.from('activity_logs').insert({
        user_id: req.userId,
        type: `feedback_submitted`,
        description: `${type.replace('_', ' ')} submitted: ${subject}`,
        metadata: { feedbackId, type },
      }).then(undefined, () => {/* non-fatal */});
    }
  } catch (insertErr: any) {
    logger.error({ err: insertErr, type, subject }, '[Feedback] DB insert threw — continuing to send email notification');
  }

  // Fire-and-forget email notification to admin — a failure here should never
  // block the response, and must not be able to throw uncaught.
  let userProfile: { email?: string; full_name?: string } | null = null;
  try {
    ({ data: userProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', req.userId).single());
  } catch (profileErr: any) {
    logger.error({ err: profileErr }, '[Feedback] profile lookup for email failed — continuing without sender name');
  }
  const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  // Race the email against a 3-second timeout so slow/broken SMTP can't stall
  // the user-facing POST. If SMTP is healthy, emailSent reflects the real result.
  // If SMTP is slow (>3s) or unconfigured, we respond immediately and the send
  // continues in the background (Promise is not cancelled, just not awaited).
  let emailSent = false;
  const emailTimeout = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 3000));
  try {
    emailSent = await Promise.race([
      emailTimeout,
      sendEmail({
        to: process.env.FEEDBACK_NOTIFY_EMAIL ?? 'feedback@getreceiptguard.xyz',
        from: EMAIL_SENDERS.feedback,
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
      }),
    ]);
  } catch {
    // sendEmail already logs internally; swallow here so response always sends
  }

  // Confirmation email to the submitting user — also fire-and-forget, raced
  // against the same timeout, and must never block or fail the response.
  let confirmationSent = false;
  if (userProfile?.email) {
    const confirmationTimeout = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 3000));
    try {
      confirmationSent = await Promise.race([
        confirmationTimeout,
        sendEmail({
          to: userProfile.email,
          from: EMAIL_SENDERS.support,
          subject: `We received your ${typeLabel.toLowerCase()} — ReceiptGuard`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#10b981;padding:24px 28px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;color:#fff;font-size:18px;">ReceiptGuard</h1>
              </div>
              <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:28px;">
                <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Thanks, we got it</h2>
                <p style="margin:0 0 20px;color:#374151;font-size:15px;">
                  Hi ${userProfile.full_name?.split(' ')[0] ?? 'there'}, we received your ${typeLabel.toLowerCase()} and our team will review it. If it needs a reply, we'll get back to you at this email address.
                </p>
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:8px">
                  <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">${typeLabel}</p>
                  <p style="margin:0;color:#111827;font-weight:600;font-size:15px;">${subject.trim()}</p>
                </div>
                <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">This is an automated confirmation from ReceiptGuard Support.</p>
              </div>
            </div>
          `,
          text: `Hi ${userProfile.full_name?.split(' ')[0] ?? 'there'},\n\nWe received your ${typeLabel.toLowerCase()}: "${subject.trim()}". Our team will review it and reply here if needed.\n\n— ReceiptGuard Support`,
        }),
      ]);
    } catch {
      // never block the response on the confirmation email
    }
  }

  res.status(201).json({
    ...(data ?? { type, subject, body, status: 'open', created_at: new Date().toISOString() }),
    emailSent,
    confirmationSent,
  });
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
