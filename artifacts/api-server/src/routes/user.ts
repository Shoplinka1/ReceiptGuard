import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

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
  // Read from dedicated settings table; fall back to sensible defaults if table not created yet
  const { data } = await supabaseAdmin.from('settings').select('*').eq('user_id', req.userId).maybeSingle();
  res.json({
    id: req.userId, userId: req.userId,
    theme: data?.theme ?? 'system',
    currency: data?.currency ?? 'USD',
    timezone: data?.timezone ?? 'UTC',
    language: data?.language ?? 'en',
    emailNotifications: data?.email_notifications ?? true,
    browserNotifications: data?.browser_notifications ?? true,
  });
});

router.patch('/api/user/settings', requireAuth, async (req, res): Promise<void> => {
  const { theme, currency, timezone, language, emailNotifications, browserNotifications } = req.body;
  // Only include columns that actually exist in the `settings` table.
  // `language` and `browser_notifications` are stored separately — see the
  // ALTER TABLE additions in supabase/schema.sql. If those columns are not yet
  // present the upsert would fail; we guard with a try/catch and fall through.
  const coreUpdates: Record<string, any> = { user_id: req.userId, updated_at: new Date().toISOString() };
  if (theme !== undefined) coreUpdates.theme = theme;
  if (currency !== undefined) coreUpdates.currency = currency;
  if (timezone !== undefined) coreUpdates.timezone = timezone;
  if (emailNotifications !== undefined) coreUpdates.email_notifications = emailNotifications;

  // Extended columns added by schema migration — only include when present
  const extUpdates: Record<string, any> = { ...coreUpdates };
  if (language !== undefined) extUpdates.language = language;
  if (browserNotifications !== undefined) extUpdates.browser_notifications = browserNotifications;

  // Try the full upsert first; fall back to core-only if extended columns don't exist yet
  let { error } = await supabaseAdmin.from('settings').upsert(extUpdates, { onConflict: 'user_id' });
  let usedCoreOnly = false;
  if (error && (error.message?.includes('language') || error.message?.includes('browser_notifications') || error.message?.includes('column'))) {
    // Schema hasn't been migrated yet — retry without the new columns
    ({ error } = await supabaseAdmin.from('settings').upsert(coreUpdates, { onConflict: 'user_id' }));
    usedCoreOnly = true;
  }
  if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
    res.status(500).json({ error: error.message }); return;
  }
  // Return only what was actually persisted so the UI doesn't cache values that were dropped
  res.json({
    theme: theme ?? 'system',
    currency: currency ?? 'USD',
    timezone: timezone ?? 'UTC',
    language: usedCoreOnly ? undefined : (language ?? 'en'),
    emailNotifications,
    browserNotifications: usedCoreOnly ? undefined : browserNotifications,
  });
});

router.get('/api/reminders/settings', requireAuth, async (req, res): Promise<void> => {
  const { data } = await supabaseAdmin.from('settings').select('*').eq('user_id', req.userId).maybeSingle();
  res.json({
    id: req.userId, userId: req.userId,
    renewalReminder:       data?.renewal_reminder       ?? true,
    warrantyReminder:      data?.warranty_reminder      ?? true,
    returnWindowReminder:  data?.return_window_reminder ?? true,
    daysBefore30:          data?.days_before_30         ?? true,
    daysBefore14:          data?.days_before_14         ?? true,
    daysBefore7:           data?.days_before_7          ?? true,
    daysBefore3:           data?.days_before_3          ?? true,
    daysBefore1:           data?.days_before_1          ?? false,
    emailNotifications:    data?.email_notifications    ?? true,
    browserNotifications:  data?.browser_notifications  ?? true,
  });
});

router.patch('/api/reminders/settings', requireAuth, async (req, res): Promise<void> => {
  const {
    renewalReminder, warrantyReminder, returnWindowReminder,
    daysBefore30, daysBefore14, daysBefore7, daysBefore3, daysBefore1,
    emailNotifications, browserNotifications,
  } = req.body;

  const updates: Record<string, any> = { user_id: req.userId, updated_at: new Date().toISOString() };
  if (renewalReminder       !== undefined) updates.renewal_reminder       = renewalReminder;
  if (warrantyReminder      !== undefined) updates.warranty_reminder      = warrantyReminder;
  if (returnWindowReminder  !== undefined) updates.return_window_reminder = returnWindowReminder;
  if (daysBefore30          !== undefined) updates.days_before_30         = daysBefore30;
  if (daysBefore14          !== undefined) updates.days_before_14         = daysBefore14;
  if (daysBefore7           !== undefined) updates.days_before_7          = daysBefore7;
  if (daysBefore3           !== undefined) updates.days_before_3          = daysBefore3;
  if (daysBefore1           !== undefined) updates.days_before_1          = daysBefore1;
  if (emailNotifications    !== undefined) updates.email_notifications    = emailNotifications;
  if (browserNotifications  !== undefined) updates.browser_notifications  = browserNotifications;

  const { error } = await supabaseAdmin.from('settings').upsert(updates, { onConflict: 'user_id' });
  if (error) {
    // If the extended reminder columns don't exist yet, log and report partial failure
    if (error.message?.includes('column') || error.message?.includes('schema cache') || error.code === 'PGRST205' || error.code === '42703') {
      logger.warn({ error: error.message }, '[reminders] Settings schema migration not yet applied — run schema.sql migrations in Supabase');
      res.status(503).json({
        error: 'Reminder settings schema not yet applied. Run the migration in supabase/schema.sql.',
        migrationRequired: true,
      });
      return;
    }
    res.status(500).json({ error: error.message }); return;
  }
  res.json({ userId: req.userId, ...req.body });
});

// Global search across receipts, subscriptions, and warranties
router.get('/api/search', requireAuth, async (req, res): Promise<void> => {
  const { q = '' } = req.query as Record<string, string>;
  if (!q.trim()) { res.json({ receipts: [], subscriptions: [], warranties: [] }); return; }

  const term = `%${q.trim()}%`;
  const [receiptRes, subRes, warRes] = await Promise.all([
    supabaseAdmin.from('receipts').select('id, merchant_name, amount, currency, purchase_date, category').eq('user_id', req.userId).or(`merchant_name.ilike.${term},category.ilike.${term},invoice_number.ilike.${term}`).limit(10),
    // Schema uses `name` column (not `company_name`)
    supabaseAdmin.from('subscriptions').select('id, name, monthly_price, status, category, renewal_date').eq('user_id', req.userId).or(`name.ilike.${term},category.ilike.${term}`).limit(10),
    supabaseAdmin.from('warranties').select('id, product_name, purchase_date, warranty_end_date').eq('user_id', req.userId).ilike('product_name', term).limit(10),
  ]);

  res.json({
    receipts: (receiptRes.data ?? []).map(r => ({ id: r.id, type: 'receipt', title: r.merchant_name, subtitle: `${r.currency} ${Number(r.amount).toFixed(2)} · ${r.category}`, date: r.purchase_date })),
    subscriptions: (subRes.data ?? []).map(s => ({ id: s.id, type: 'subscription', title: s.name, subtitle: `${Number(s.monthly_price ?? 0).toFixed(2)}/mo · ${s.status}`, date: s.renewal_date })),
    // warranties uses warranty_end_date (not expiry_date)
    warranties: (warRes.data ?? []).map(w => ({ id: w.id, type: 'warranty', title: w.product_name, subtitle: `Expires ${w.warranty_end_date ?? 'unknown'}`, date: w.purchase_date })),
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
