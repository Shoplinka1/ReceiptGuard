/**
 * Admin Dashboard Routes
 * All routes require the user to have is_admin=true on their profile.
 * Uses service-role client — bypasses RLS.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import type { Request, Response, NextFunction } from 'express';

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { data, error } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', req.userId).single();
  if (error || !data?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

const adminGuard = [requireAuth, requireAdmin];

// ─── User Stats ──────────────────────────────────────────────────────────────

router.get('/api/admin/stats', ...adminGuard, async (_req, res): Promise<void> => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: totalUsers },
    { count: newUsers },
    { count: usersToday },
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
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
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
  ]);

  const mrr = (mrrPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalRevenue = (totalPaymentsData ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    totalUsers: totalUsers ?? 0,
    newUsers30d: newUsers ?? 0,
    usersToday: usersToday ?? 0,
    payingUsers: payingUsers ?? 0,
    freeUsers: freeUsers ?? 0,
    activeUsers: activeUsers ?? 0,
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    failedPaymentsCount: failedPaymentsCount ?? 0,
    conversionRate: totalUsers ? Math.round(((payingUsers ?? 0) / (totalUsers ?? 1)) * 10000) / 100 : 0,
    totalReceipts: totalReceipts ?? 0,
    connectedGmailAccounts: gmailAccounts ?? 0,
    openFeedbackCount: openFeedbackCount ?? 0,
    recentActivity: recentActivity ?? [],
    upcomingExpiries: expiryData ?? [],
  });
});

// ─── Users ───────────────────────────────────────────────────────────────────

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
  if (error) { res.status(500).json({ error: error.message }); return; }
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
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

router.delete('/api/admin/users/:id', ...adminGuard, async (req, res): Promise<void> => {
  const { id } = req.params;

  // Delete auth user (cascades to profile via trigger)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id as string);
  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: req.userId,
    action: 'user_deleted',
    target_type: 'user',
    target_id: id,
  });

  res.sendStatus(204);
});

// ─── Payments ────────────────────────────────────────────────────────────────

router.get('/api/admin/payments', ...adminGuard, async (_req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*, profiles(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ─── Gmail Accounts ──────────────────────────────────────────────────────────

router.get('/api/admin/gmail-accounts', ...adminGuard, async (req, res): Promise<void> => {
  const { search, page: pageRaw = '1', pageSize: pageSizeRaw = '20' } = req.query as Record<string, string>;
  const page = parseInt(pageRaw, 10);
  const pageSize = Math.min(parseInt(pageSizeRaw, 10), 100);
  if (isNaN(page) || page < 1 || isNaN(pageSize) || pageSize < 1) {
    res.status(400).json({ error: 'Invalid page or pageSize' }); return;
  }
  const offset = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from('email_accounts')
    .select('id, email, provider, is_active, last_scanned_at, created_at, user_id, profiles!email_accounts_user_id_fkey(email, full_name)', { count: 'exact' })
    .eq('provider', 'gmail')
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(pageSize) - 1);

  if (search) query = (query as any).or(`email.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ accounts: data ?? [], total: count ?? 0, page, pageSize });
});

// ─── Feedback ────────────────────────────────────────────────────────────────

router.get('/api/admin/feedback', ...adminGuard, async (req, res): Promise<void> => {
  const { type, status } = req.query as Record<string, string>;

  let query = supabaseAdmin
    .from('feedback')
    .select('*, profiles(email, full_name)')
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
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
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});

export default router;
