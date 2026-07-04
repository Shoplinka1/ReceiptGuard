import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

router.get('/api/user/profile', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin.from('profiles').select('*, user_subscriptions(*, plans(*)), email_accounts(id, email, is_active)').eq('id', req.userId).single();
  if (error || !data) { res.status(404).json({ error: 'Profile not found' }); return; }
  res.json({
    id: data.id, name: data.full_name, email: data.email, avatarUrl: data.avatar_url ?? null,
    plan: data.plan_id as 'free' | 'pro', gmailConnected: (data.email_accounts as any[])?.some(a => a.is_active) ?? false,
    gmailEmail: (data.email_accounts as any[])?.[0]?.email ?? null, storageUsed: 0, createdAt: data.created_at,
  });
});

router.patch('/api/user/profile', requireAuth, async (req, res): Promise<void> => {
  const { name, avatarUrl } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name) updates.full_name = name;
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
  const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', req.userId).select().single();
  if (error || !data) { res.status(500).json({ error: error?.message ?? 'Update failed' }); return; }
  res.json({ id: data.id, name: data.full_name, email: data.email, avatarUrl: data.avatar_url ?? null, plan: data.plan_id, createdAt: data.created_at });
});

router.get('/api/user/settings', requireAuth, async (req, res): Promise<void> => {
  const { data } = await supabaseAdmin.from('profiles').select('theme, currency, timezone, language, email_notifications, browser_notifications').eq('id', req.userId).single();
  res.json({ id: req.userId, userId: req.userId, theme: data?.theme ?? 'system', currency: data?.currency ?? 'USD', timezone: data?.timezone ?? 'UTC', language: data?.language ?? 'en', emailNotifications: data?.email_notifications ?? true, browserNotifications: data?.browser_notifications ?? true });
});

router.patch('/api/user/settings', requireAuth, async (req, res): Promise<void> => {
  const { theme, currency, timezone, language, emailNotifications, browserNotifications } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (theme) updates.theme = theme;
  if (currency) updates.currency = currency;
  if (timezone) updates.timezone = timezone;
  if (language) updates.language = language;
  if (emailNotifications !== undefined) updates.email_notifications = emailNotifications;
  if (browserNotifications !== undefined) updates.browser_notifications = browserNotifications;
  await supabaseAdmin.from('profiles').update(updates).eq('id', req.userId);
  res.json({ theme: theme ?? 'system', currency: currency ?? 'USD', timezone: timezone ?? 'UTC', language: language ?? 'en', emailNotifications, browserNotifications });
});

router.get('/api/reminders/settings', requireAuth, async (req, res): Promise<void> => {
  // Reminders are stored as profile settings for simplicity
  res.json({
    id: req.userId, userId: req.userId, renewalReminder: true, warrantyReminder: true,
    returnWindowReminder: true, daysBefore30: true, daysBefore14: true, daysBefore7: true, daysBefore3: true, daysBefore1: false,
    emailNotifications: true, browserNotifications: true,
  });
});

router.patch('/api/reminders/settings', requireAuth, async (req, res): Promise<void> => {
  // Could persist to a separate table; for now reflect back the request
  res.json({ userId: req.userId, ...req.body });
});

// Global search across receipts, subscriptions, and warranties
router.get('/api/search', requireAuth, async (req, res): Promise<void> => {
  const { q = '' } = req.query as Record<string, string>;
  if (!q.trim()) { res.json({ receipts: [], subscriptions: [], warranties: [] }); return; }

  const term = `%${q.trim()}%`;
  const [receiptRes, subRes, warRes] = await Promise.all([
    supabaseAdmin.from('receipts').select('id, merchant_name, amount, currency, purchase_date, category').eq('user_id', req.userId).or(`merchant_name.ilike.${term},category.ilike.${term},invoice_number.ilike.${term}`).limit(10),
    supabaseAdmin.from('subscriptions').select('id, company_name, monthly_price, status, category, renewal_date').eq('user_id', req.userId).or(`company_name.ilike.${term},category.ilike.${term}`).limit(10),
    supabaseAdmin.from('warranties').select('id, product_name, purchase_date, expiry_date').eq('user_id', req.userId).ilike('product_name', term).limit(10),
  ]);

  res.json({
    receipts: (receiptRes.data ?? []).map(r => ({ id: r.id, type: 'receipt', title: r.merchant_name, subtitle: `${r.currency} ${Number(r.amount).toFixed(2)} · ${r.category}`, date: r.purchase_date })),
    subscriptions: (subRes.data ?? []).map(s => ({ id: s.id, type: 'subscription', title: s.company_name, subtitle: `$${Number(s.monthly_price).toFixed(2)}/mo · ${s.status}`, date: s.renewal_date })),
    warranties: (warRes.data ?? []).map(w => ({ id: w.id, type: 'warranty', title: w.product_name, subtitle: `Expires ${w.expiry_date ?? 'unknown'}`, date: w.purchase_date })),
  });
});

// Delete account — removes all user data and auth account
router.delete('/api/user/account', requireAuth, async (req, res): Promise<void> => {
  const uid = req.userId;
  // Delete all user data in dependency order
  await Promise.all([
    supabaseAdmin.from('payments').delete().eq('user_id', uid),
    supabaseAdmin.from('activity_logs').delete().eq('user_id', uid),
    supabaseAdmin.from('notifications').delete().eq('user_id', uid),
    supabaseAdmin.from('feedback').delete().eq('user_id', uid),
    supabaseAdmin.from('reminders').delete().eq('user_id', uid),
  ]);
  await Promise.all([
    supabaseAdmin.from('renewals').delete().eq('user_id', uid),
    supabaseAdmin.from('warranties').delete().eq('user_id', uid),
    supabaseAdmin.from('subscriptions').delete().eq('user_id', uid),
    supabaseAdmin.from('receipts').delete().eq('user_id', uid),
    supabaseAdmin.from('user_subscriptions').delete().eq('user_id', uid),
    supabaseAdmin.from('email_accounts').delete().eq('user_id', uid),
  ]);
  await supabaseAdmin.from('settings').delete().eq('user_id', uid);
  await supabaseAdmin.from('profiles').delete().eq('id', uid);
  // Delete Supabase auth user last
  await supabaseAdmin.auth.admin.deleteUser(uid);
  res.sendStatus(204);
});

export default router;
