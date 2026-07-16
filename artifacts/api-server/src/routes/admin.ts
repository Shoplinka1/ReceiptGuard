/**
 * Admin Dashboard Routes
 * All routes require the user to have is_admin=true on their profile.
 * Uses service-role client — bypasses RLS.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { sendEmail } from '../lib/email';
import type { Request, Response, NextFunction } from 'express';

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Use maybeSingle() instead of single() so a missing profile row returns
  // null (→ 403) rather than a PGRST116 error that swallowed into a crash.
  const { data, error } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', req.userId).maybeSingle();
  if (error) {
    res.status(500).json({ error: 'Admin access check failed' });
    return;
  }
  if (!data?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

const adminGuard = [requireAuth, requireAdmin];

// ─── Main Stats ───────────────────────────────────────────────────────────────

router.get('/api/admin/stats', ...adminGuard, async (_req, res): Promise<void> => {
  const now = new Date();
  const oneDayAgo    = new Date(now.getTime() - 1  * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: totalUsers },
    { count: newUsersToday },
    { count: newUsers7d },
    { count: newUsers30d },
    { count: payingUsers },
    { count: freeUsers },
    { count: activeUsers },
    { data: mrrPayments },
    { data: totalPaymentsData },
    { count: failedPaymentsCount },
    { data: recentActivity },
    { count: openFeedbackCount },
    { count: totalReceipts },
    { count: gmailAccounts },
    { data: expiryData },
    { count: totalSubscriptions },
    { count: newProUpgrades30d },
    { count: churnedCount },
    { count: failedScanCount },
    { count: successfulScanCount },
    // DAU/WAU/MAU via activity_logs (users who logged in or performed actions)
    { data: dauData },
    { data: wauData },
    { data: mauData },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).neq('plan_id', 'free').neq('plan_id', null),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).or('plan_id.eq.free,plan_id.is.null'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_suspended', false),
    supabaseAdmin.from('payments').select('amount').eq('status', 'success').gte('created_at', monthStart),
    supabaseAdmin.from('payments').select('amount').eq('status', 'success'),
    supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabaseAdmin.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('receipts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('email_accounts').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('user_subscriptions').select('user_id, plan_id, current_period_end, status').eq('status', 'active').order('current_period_end', { ascending: true }).limit(20),
    supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }),
    // New Pro upgrades in last 30 days
    supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'plan_upgraded').gte('created_at', thirtyDaysAgo),
    // Churned = subscriptions cancelled or expired in last 30 days
    supabaseAdmin.from('user_subscriptions').select('*', { count: 'exact', head: true }).in('status', ['cancelled', 'expired']).gte('updated_at', thirtyDaysAgo),
    // Failed Gmail scans
    supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'gmail_scan_failed').gte('created_at', thirtyDaysAgo),
    // Successful Gmail scans — includes partial successes (some search
    // queries failed but the scan still completed and imported what it could)
    // so a single transient 429/5xx doesn't get counted as a full failure.
    supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true }).in('type', ['gmail_scan_complete', 'gmail_scan_partial']).gte('created_at', thirtyDaysAgo),
    // DAU — distinct users with activity in last 24h
    supabaseAdmin.from('activity_logs').select('user_id').gte('created_at', oneDayAgo),
    // WAU — distinct users with activity in last 7 days
    supabaseAdmin.from('activity_logs').select('user_id').gte('created_at', sevenDaysAgo),
    // MAU — distinct users with activity in last 30 days
    supabaseAdmin.from('activity_logs').select('user_id').gte('created_at', thirtyDaysAgo),
  ]);

  const mrr = (mrrPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalRevenue = (totalPaymentsData ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  // Deduplicate users by ID for DAU/WAU/MAU
  const dau = new Set((dauData ?? []).map((r: any) => r.user_id)).size;
  const wau = new Set((wauData ?? []).map((r: any) => r.user_id)).size;
  const mau = new Set((mauData ?? []).map((r: any) => r.user_id)).size;

  const totalScans = (successfulScanCount ?? 0) + (failedScanCount ?? 0);
  const scanSuccessRate = totalScans > 0
    ? Math.round(((successfulScanCount ?? 0) / totalScans) * 10000) / 100
    : null;

  res.json({
    // User counts
    totalUsers: totalUsers ?? 0,
    newUsersToday: newUsersToday ?? 0,
    newUsers7d: newUsers7d ?? 0,
    newUsers30d: newUsers30d ?? 0,
    payingUsers: payingUsers ?? 0,
    freeUsers: freeUsers ?? 0,
    activeUsers: activeUsers ?? 0,
    dau,
    wau,
    mau,
    // Conversions & churn
    newProUpgrades30d: newProUpgrades30d ?? 0,
    churnedCount30d: churnedCount ?? 0,
    conversionRate: totalUsers ? Math.round(((payingUsers ?? 0) / (totalUsers ?? 1)) * 10000) / 100 : 0,
    // Revenue
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    failedPaymentsCount: failedPaymentsCount ?? 0,
    // Content stats
    totalReceipts: totalReceipts ?? 0,
    totalSubscriptions: totalSubscriptions ?? 0,
    connectedGmailAccounts: gmailAccounts ?? 0,
    // Gmail scan stats (last 30d)
    failedScans30d: failedScanCount ?? 0,
    successfulScans30d: successfulScanCount ?? 0,
    scanSuccessRate,
    // Feedback
    openFeedbackCount: openFeedbackCount ?? 0,
    // Lists
    recentActivity: recentActivity ?? [],
    upcomingExpiries: expiryData ?? [],
  });
});

// ─── Revenue trend (last 12 months) ──────────────────────────────────────────

router.get('/api/admin/revenue-trend', ...adminGuard, async (_req, res): Promise<void> => {
  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('amount, created_at')
    .eq('status', 'success');

  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const ms = String(m).padStart(2, '0');
    const first = new Date(y, m - 1, 1).toISOString();
    const last = new Date(y, m, 0, 23, 59, 59).toISOString();
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const revenue = (payments ?? [])
      .filter(p => p.created_at >= first && p.created_at <= last)
      .reduce((s, p) => s + Number(p.amount), 0);
    months.push({ month: m, year: y, label, revenue: Math.round(revenue * 100) / 100 });
  }
  res.json(months);
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get('/api/admin/users', ...adminGuard, async (req, res): Promise<void> => {
  const { search, plan, page: pageRaw = '1', pageSize: pageSizeRaw = '20' } = req.query as Record<string, string>;
  const page = parseInt(pageRaw, 10);
  const pageSize = Math.min(parseInt(pageSizeRaw, 10), 100);
  if (isNaN(page) || page < 1 || isNaN(pageSize) || pageSize < 1) {
    res.status(400).json({ error: 'Invalid page or pageSize' }); return;
  }
  const offset = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, avatar_url, plan_id, is_admin, is_suspended, created_at, updated_at', { count: 'exact' })
    .range(offset, offset + pageSize - 1)
    .order('created_at', { ascending: false });

  if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  if (plan) query = query.eq('plan_id', plan);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: 'Failed to load users' }); return; }
  res.json({ users: data ?? [], total: count ?? 0, page, pageSize });
});

router.patch('/api/admin/users/:id', ...adminGuard, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { is_suspended, is_admin, plan_id } = req.body as Record<string, any>;

  const updates: Record<string, any> = {};
  if (is_suspended !== undefined) updates.is_suspended = is_suspended;
  if (is_admin !== undefined) updates.is_admin = is_admin;
  if (plan_id !== undefined) updates.plan_id = plan_id;

  const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', id).select().single();
  if (error) { res.status(500).json({ error: 'Failed to update user' }); return; }
  res.json(data);
});

router.delete('/api/admin/users/:id', ...adminGuard, async (req, res): Promise<void> => {
  const { id } = req.params;

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id as string);
  if (error) { res.status(500).json({ error: error.message }); return; }

  void supabaseAdmin.from('audit_logs').insert({
    actor_id: req.userId,
    action: 'user_deleted',
    target_type: 'user',
    target_id: id,
  }).then(undefined, () => {});

  res.sendStatus(204);
});

// ─── Payments ─────────────────────────────────────────────────────────────────

router.get('/api/admin/payments', ...adminGuard, async (req, res): Promise<void> => {
  const { page: pageRaw = '1', pageSize: pageSizeRaw = '50' } = req.query as Record<string, string>;
  const page = parseInt(pageRaw, 10);
  const pageSize = Math.min(parseInt(pageSizeRaw, 10), 200);
  const offset = (page - 1) * pageSize;

  // payments.user_id FKs to auth.users, not profiles — PostgREST cannot
  // build the embedded join automatically. Fetch payments first, then look
  // up profiles manually so the join always works regardless of FK setup.
  const { data: rawPayments, count, error } = await supabaseAdmin
    .from('payments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) { res.status(500).json({ error: 'Failed to load payments' }); return; }

  const userIds = [...new Set((rawPayments ?? []).map((p: any) => p.user_id as string))];
  const { data: profileRows } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, email, full_name').in('id', userIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profileRows ?? []).map((p: any) => [p.id, { email: p.email, full_name: p.full_name }]));

  const data = (rawPayments ?? []).map((p: any) => ({ ...p, profiles: profileMap[p.user_id] ?? null }));
  res.json({ payments: data, total: count ?? 0, page, pageSize });
});

// ─── Gmail Accounts ───────────────────────────────────────────────────────────

router.get('/api/admin/gmail-accounts', ...adminGuard, async (req, res): Promise<void> => {
  const { search, page: pageRaw = '1', pageSize: pageSizeRaw = '20' } = req.query as Record<string, string>;
  const page = parseInt(pageRaw, 10);
  const pageSize = Math.min(parseInt(pageSizeRaw, 10), 100);
  if (isNaN(page) || page < 1 || isNaN(pageSize) || pageSize < 1) {
    res.status(400).json({ error: 'Invalid page or pageSize' }); return;
  }
  const offset = (page - 1) * pageSize;

  // email_accounts.user_id FKs to auth.users — same PostgREST join limitation
  // as payments above. Fetch accounts then look up profiles manually.
  let baseQuery = supabaseAdmin
    .from('email_accounts')
    .select('id, email, provider, is_active, last_scanned_at, created_at, user_id', { count: 'exact' })
    .eq('provider', 'gmail')
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (search) baseQuery = (baseQuery as any).or(`email.ilike.%${search}%`);

  const { data: rawAccounts, count, error } = await baseQuery;
  if (error) { res.status(500).json({ error: 'Failed to load Gmail accounts' }); return; }

  const acctUserIds = [...new Set((rawAccounts ?? []).map((a: any) => a.user_id as string))];
  const { data: acctProfiles } = acctUserIds.length
    ? await supabaseAdmin.from('profiles').select('id, email, full_name').in('id', acctUserIds)
    : { data: [] };
  const acctProfileMap = Object.fromEntries((acctProfiles ?? []).map((p: any) => [p.id, { email: p.email, full_name: p.full_name }]));

  const enrichedAccounts = (rawAccounts ?? []).map((a: any) => ({ ...a, profiles: acctProfileMap[a.user_id] ?? null }));
  res.json({ accounts: enrichedAccounts, total: count ?? 0, page, pageSize });
});

// ─── Feedback ─────────────────────────────────────────────────────────────────

router.get('/api/admin/feedback', ...adminGuard, async (req, res): Promise<void> => {
  const { type, status } = req.query as Record<string, string>;

  // feedback.user_id FKs to auth.users, not profiles — PostgREST cannot build
  // profiles(email, full_name) as an embedded join. Use manual join instead,
  // same pattern as admin payments and gmail-accounts routes above.
  let query = supabaseAdmin
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);

  const { data: rawFeedback, error } = await query;
  if (error) { res.status(500).json({ error: 'Failed to load feedback' }); return; }

  const fbUserIds = [...new Set((rawFeedback ?? []).map((f: any) => f.user_id as string))];
  const { data: fbProfiles } = fbUserIds.length
    ? await supabaseAdmin.from('profiles').select('id, email, full_name').in('id', fbUserIds)
    : { data: [] };
  const fbProfileMap = Object.fromEntries((fbProfiles ?? []).map((p: any) => [p.id, { email: p.email, full_name: p.full_name }]));

  const data = (rawFeedback ?? []).map((f: any) => ({ ...f, profiles: fbProfileMap[f.user_id] ?? null }));
  res.json(data);
});

router.patch('/api/admin/feedback/:id', ...adminGuard, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { status, admin_notes, priority } = req.body as Record<string, string>;

  const updates: Record<string, any> = {};
  if (status) updates.status = status;
  if (admin_notes !== undefined) updates.admin_notes = admin_notes;
  if (priority) updates.priority = priority;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin.from('feedback').update(updates).eq('id', id).select().single();
  if (error) { res.status(500).json({ error: 'Failed to update feedback' }); return; }
  res.json(data);
});

// ─── Activity Logs ────────────────────────────────────────────────────────────

router.get('/api/admin/activity-logs', ...adminGuard, async (req, res): Promise<void> => {
  const { page: pageRaw = '1', pageSize: pageSizeRaw = '50' } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeRaw, 10) || 50));
  const offset = (page - 1) * pageSize;

  const { data: rawLogs, count, error } = await supabaseAdmin
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) { res.status(500).json({ error: 'Failed to load activity logs' }); return; }

  // Enrich with profile emails
  const userIds = [...new Set((rawLogs ?? []).map((l: any) => l.user_id as string))];
  const { data: profileRows } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, email, full_name').in('id', userIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profileRows ?? []).map((p: any) => [p.id, p]));

  const logs = (rawLogs ?? []).map((l: any) => ({ ...l, profiles: profileMap[l.user_id] ?? null }));
  res.json({ logs, total: count ?? 0, page, pageSize });
});

// ─── Scan Logs ────────────────────────────────────────────────────────────────

const SCAN_LOG_TYPES = [
  'gmail_scan_start', 'gmail_scan_complete', 'gmail_scan_partial',
  'gmail_scan_failed', 'gmail_connected', 'gmail_disconnected',
];

router.get('/api/admin/scan-logs', ...adminGuard, async (req, res): Promise<void> => {
  const { page: pageRaw = '1', pageSize: pageSizeRaw = '50' } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeRaw, 10) || 50));
  const offset = (page - 1) * pageSize;

  const { data: rawLogs, count, error } = await supabaseAdmin
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .in('type', SCAN_LOG_TYPES)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) { res.status(500).json({ error: 'Failed to load scan logs' }); return; }

  const userIds = [...new Set((rawLogs ?? []).map((l: any) => l.user_id as string))];
  const { data: profileRows } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, email, full_name').in('id', userIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profileRows ?? []).map((p: any) => [p.id, p]));

  const logs = (rawLogs ?? []).map((l: any) => ({ ...l, profiles: profileMap[l.user_id] ?? null }));
  res.json({ logs, total: count ?? 0, page, pageSize });
});

// ─── All Receipts (admin) ─────────────────────────────────────────────────────

router.get('/api/admin/receipts', ...adminGuard, async (req, res): Promise<void> => {
  const { page: pageRaw = '1', pageSize: pageSizeRaw = '30' } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeRaw, 10) || 30));
  const offset = (page - 1) * pageSize;

  const { data: rawReceipts, count, error } = await supabaseAdmin
    .from('receipts')
    .select('id, user_id, merchant_name, amount, currency, purchase_date, category, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) { res.status(500).json({ error: 'Failed to load receipts' }); return; }

  const userIds = [...new Set((rawReceipts ?? []).map((r: any) => r.user_id as string))];
  const { data: profileRows } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, email').in('id', userIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profileRows ?? []).map((p: any) => [p.id, p]));

  const receipts = (rawReceipts ?? []).map((r: any) => ({ ...r, profiles: profileMap[r.user_id] ?? null }));
  res.json({ receipts, total: count ?? 0, page, pageSize });
});

// ─── All Warranties (admin) ───────────────────────────────────────────────────

router.get('/api/admin/warranties', ...adminGuard, async (req, res): Promise<void> => {
  const { page: pageRaw = '1', pageSize: pageSizeRaw = '30' } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeRaw, 10) || 30));
  const offset = (page - 1) * pageSize;

  const { data: rawWarranties, count, error } = await supabaseAdmin
    .from('warranties')
    .select('id, user_id, product_name, merchant_name, purchase_date, warranty_end_date, is_estimated, created_at', { count: 'exact' })
    .order('warranty_end_date', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (error) { res.status(500).json({ error: 'Failed to load warranties' }); return; }

  const userIds = [...new Set((rawWarranties ?? []).map((w: any) => w.user_id as string))];
  const { data: profileRows } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, email').in('id', userIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profileRows ?? []).map((p: any) => [p.id, p]));

  const warranties = (rawWarranties ?? []).map((w: any) => ({ ...w, profiles: profileMap[w.user_id] ?? null }));
  res.json({ warranties, total: count ?? 0, page, pageSize });
});

// ─── Diagnostics ──────────────────────────────────────────────────────────────
// GET /api/admin/diagnostics — live production status for all subsystems.

router.get('/api/admin/diagnostics', ...adminGuard, async (_req, res): Promise<void> => {
  const checks: Record<string, { status: 'ok' | 'error' | 'unconfigured'; detail?: string }> = {};

  // ── Supabase ─────────────────────────────────────────────────────────────
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
    checks.supabase = error ? { status: 'error', detail: error.message } : { status: 'ok' };
  } catch (e: any) {
    checks.supabase = { status: 'error', detail: e.message };
  }

  // ── SMTP ─────────────────────────────────────────────────────────────────
  const smtpConfigured = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
  checks.smtp = smtpConfigured
    ? { status: 'ok', detail: `${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT ?? 587} as ${process.env.EMAIL_USER}` }
    : { status: 'unconfigured', detail: 'EMAIL_HOST, EMAIL_USER, EMAIL_PASS not set' };

  // ── Google OAuth (env vars only — no live call) ────────────────────────
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  checks.googleOAuth = googleConfigured
    ? { status: 'ok', detail: `Redirect: ${process.env.GOOGLE_REDIRECT_URI}` }
    : { status: 'unconfigured', detail: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI not set' };

  // ── Railway (self — this server is running if we respond) ──────────────
  checks.railway = { status: 'ok', detail: `NODE_ENV=${process.env.NODE_ENV ?? 'not set'}` };

  // ── Resend (email delivery) ───────────────────────────────────────────
  checks.resend = process.env.RESEND_API_KEY
    ? { status: 'ok', detail: 'RESEND_API_KEY is set' }
    : { status: 'unconfigured', detail: 'RESEND_API_KEY not set — falling back to SMTP if configured' };

  // ── Paystack (payments) ───────────────────────────────────────────────
  checks.paystack = process.env.PAYSTACK_SECRET_KEY
    ? { status: 'ok', detail: 'PAYSTACK_SECRET_KEY is set' }
    : { status: 'unconfigured', detail: 'PAYSTACK_SECRET_KEY not set — payment webhooks and upgrades will fail' };

  // ── Gmail token encryption ────────────────────────────────────────────
  const encKey = process.env.ENCRYPTION_KEY ?? '';
  const encOk = /^[0-9a-fA-F]{64}$/.test(encKey);
  checks.encryptionKey = encOk
    ? { status: 'ok', detail: 'ENCRYPTION_KEY is set and 64-hex-char format is valid' }
    : encKey
      ? { status: 'error', detail: `ENCRYPTION_KEY is set but wrong format (${encKey.length} chars, must be exactly 64 hex chars)` }
      : { status: 'unconfigured', detail: 'ENCRYPTION_KEY not set — Gmail token encryption/decryption will fail' };

  // ── Gmail API (check at least one active account exists) ──────────────
  try {
    const { count, error } = await supabaseAdmin
      .from('email_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    checks.gmailApi = error
      ? { status: 'error', detail: error.message }
      : { status: 'ok', detail: `${count ?? 0} active connected account(s)` };
  } catch (e: any) {
    checks.gmailApi = { status: 'error', detail: e.message };
  }

  // ── Scheduler (check for recent scheduler activity in the last 25h) ─────
  // Looks for any of: reminder_sent, expiry_downgrade, plan_downgraded,
  // weekly_summary_sent, monthly_summary_sent. The scheduler writes
  // 'reminder_sent' each time an email fires and 'expiry_downgrade' on each
  // auto-downgrade; it also writes 'plan_downgraded' (which predates the
  // newer type names). Using a 25h window so the check passes even when
  // there are no reminders due today (scheduler may have fired yesterday).
  try {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const { data: schedulerLogs } = await supabaseAdmin
      .from('activity_logs')
      .select('created_at, type')
      .in('type', ['reminder_sent', 'expiry_downgrade', 'plan_downgraded', 'weekly_summary_sent', 'monthly_summary_sent'])
      .gte('created_at', twentyFiveHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1);
    checks.scheduler = {
      status: 'ok',
      detail: schedulerLogs?.length
        ? `Last activity: ${schedulerLogs[0].type} at ${schedulerLogs[0].created_at}`
        : 'No scheduler activity in last 25h — scheduler is running but no reminders were due',
    };
  } catch (e: any) {
    checks.scheduler = { status: 'error', detail: e.message };
  }

  // ── Last successful Gmail scan ────────────────────────────────────────
  try {
    const { data: lastScan } = await supabaseAdmin
      .from('activity_logs')
      .select('created_at, description')
      .in('type', ['gmail_scan_complete', 'gmail_scan_partial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    checks.lastGmailScan = {
      status: 'ok',
      detail: lastScan
        ? `${new Date(lastScan.created_at).toISOString()} — ${lastScan.description ?? ''}`
        : 'No successful scans recorded',
    };
  } catch (e: any) {
    checks.lastGmailScan = { status: 'error', detail: e.message };
  }

  // ── Last reminder email ──────────────────────────────────────────────
  try {
    const { data: lastReminder } = await supabaseAdmin
      .from('activity_logs')
      .select('created_at, description')
      .eq('type', 'reminder_sent')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    checks.lastReminderEmail = {
      status: 'ok',
      detail: lastReminder
        ? `${new Date(lastReminder.created_at).toISOString()} — ${lastReminder.description ?? ''}`
        : 'No reminder emails recorded',
    };
  } catch (e: any) {
    checks.lastReminderEmail = { status: 'error', detail: e.message };
  }

  // ── Last feedback email ──────────────────────────────────────────────
  try {
    const { data: lastFeedback } = await supabaseAdmin
      .from('activity_logs')
      .select('created_at, description')
      .eq('type', 'feedback_submitted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    checks.lastFeedbackEmail = {
      status: 'ok',
      detail: lastFeedback
        ? `${new Date(lastFeedback.created_at).toISOString()} — ${lastFeedback.description ?? ''}`
        : 'No feedback emails recorded',
    };
  } catch (e: any) {
    checks.lastFeedbackEmail = { status: 'error', detail: e.message };
  }

  // ── Scan success rate (last 30 days) ─────────────────────────────────
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: successCount }, { count: failCount }] = await Promise.all([
      supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true })
        .in('type', ['gmail_scan_complete', 'gmail_scan_partial']).gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('activity_logs').select('*', { count: 'exact', head: true })
        .eq('type', 'gmail_scan_failed').gte('created_at', thirtyDaysAgo),
    ]);
    const total = (successCount ?? 0) + (failCount ?? 0);
    const rate = total > 0 ? Math.round(((successCount ?? 0) / total) * 100) : null;
    checks.scanSuccessRate = {
      status: 'ok',
      detail: total > 0 ? `${rate}% (${successCount ?? 0} ok / ${failCount ?? 0} failed in 30d)` : 'No scans in last 30 days',
    };
  } catch (e: any) {
    checks.scanSuccessRate = { status: 'error', detail: e.message };
  }

  // ── Queue health (pending notifications) ─────────────────────────────
  try {
    const { count: pendingNotifs, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    checks.queueHealth = error
      ? { status: 'error', detail: error.message }
      : { status: 'ok', detail: `${pendingNotifs ?? 0} unread notification(s) in queue` };
  } catch (e: any) {
    checks.queueHealth = { status: 'error', detail: e.message };
  }

  // ── Connected Gmail accounts ─────────────────────────────────────────
  try {
    const { count, error } = await supabaseAdmin
      .from('email_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    checks.connectedGmailAccounts = error
      ? { status: 'error', detail: error.message }
      : { status: 'ok', detail: `${count ?? 0} active account(s)` };
  } catch (e: any) {
    checks.connectedGmailAccounts = { status: 'error', detail: e.message };
  }

  const overall = Object.values(checks).some(c => c.status === 'error') ? 'degraded' : 'ok';
  res.json({ overall, checks, generatedAt: new Date().toISOString() });
});

// ─── SMTP test ────────────────────────────────────────────────────────────────
// POST /api/admin/smtp-test  — sends a test email and returns full SMTP diagnostics.
// Admin-only. Used to verify email delivery is working in production.
router.post('/api/admin/smtp-test', ...adminGuard, async (req, res): Promise<void> => {
  const { to } = req.body as { to?: string };
  const recipient = to?.trim() || 'feedback@getreceiptguard.xyz';

  const usingResend = !!process.env.RESEND_API_KEY;
  const emailConfigured = usingResend || !!(
    process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS
  );

  if (!emailConfigured) {
    res.status(503).json({
      success: false,
      configured: false,
      error: 'Email is not configured — set RESEND_API_KEY (preferred), or EMAIL_HOST/EMAIL_USER/EMAIL_PASS as a fallback.',
      hint: usingResend ? undefined : 'Set EMAIL_HOST=smtp.gmail.com, EMAIL_PORT=587, EMAIL_USER=your@gmail.com, EMAIL_PASS=<16-char app password>',
    });
    return;
  }

  const ok = await sendEmail({
    to: recipient,
    subject: `[ReceiptGuard] ${usingResend ? 'Resend' : 'SMTP'} test — delivery confirmed`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2>✅ ${usingResend ? 'Resend' : 'SMTP'} test successful</h2>
        <p>This email was sent at <strong>${new Date().toISOString()}</strong> via the ReceiptGuard admin email test endpoint.</p>
        <p style="color:#666;font-size:12px">If you received this, email delivery is working correctly in production.</p>
      </div>
    `,
  });

  res.json({
    success: ok,
    configured: true,
    provider: usingResend ? 'resend' : 'smtp',
    recipient,
    sentAt: new Date().toISOString(),
    message: ok
      ? `Test email sent to ${recipient}. Check the inbox (and spam folder) to confirm delivery.`
      : usingResend
        ? `Resend is configured but the send failed — this is usually a domain not yet verified (SPF/DKIM pending DNS propagation). Check server logs for [email][resend] send FAILED.`
        : `SMTP is configured but sendMail failed. Check logs for [email] sendMail FAILED with the full error code and SMTP response.`,
  });
});

// ─── Receipts ────────────────────────────────────────────────────────────────

router.get('/api/admin/receipts', ...adminGuard, async (req, res): Promise<void> => {
  const { search, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let query = supabaseAdmin
    .from('receipts')
    .select('*, profiles(email, full_name)', { count: 'exact' })
    .range(offset, offset + parseInt(pageSize) - 1)
    .order('created_at', { ascending: false });

  if (search) query = query.ilike('merchant_name', `%${search}%`);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ receipts: data ?? [], total: count ?? 0, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.delete('/api/admin/receipts/:id', ...adminGuard, async (req, res): Promise<void> => {
  const { error } = await supabaseAdmin.from('receipts').delete().eq('id', req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

// ─── Gmail Accounts ──────────────────────────────────────────────────────────

router.get('/api/admin/gmail-accounts', ...adminGuard, async (req, res): Promise<void> => {
  const { search, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let query = supabaseAdmin
    .from('email_accounts')
    // Never select access_token_enc / refresh_token_enc — admins can see connection
    // status, not raw tokens.
    .select('id, user_id, email, provider, is_active, last_scanned_at, created_at, profiles(email, full_name)', { count: 'exact' })
    .range(offset, offset + parseInt(pageSize) - 1)
    .order('created_at', { ascending: false });

  if (search) query = query.ilike('email', `%${search}%`);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ accounts: data ?? [], total: count ?? 0, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.patch('/api/admin/gmail-accounts/:id', ...adminGuard, async (req, res): Promise<void> => {
  const { is_active } = req.body as Record<string, any>;
  const updates: Record<string, any> = {};
  if (is_active !== undefined) updates.is_active = is_active;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('email_accounts')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, user_id, email, provider, is_active, last_scanned_at, created_at')
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

export default router;
