import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

router.get('/api/renewals', requireAuth, async (req, res): Promise<void> => {
  const { period, month, year } = req.query as Record<string, string>;
  const today = new Date().toISOString().split('T')[0];
  let from = today;
  let to = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  if (period) {
    const now = new Date();
    switch (period) {
      case 'today': from = to = today; break;
      case 'this_week': {
        const d = now.getDay();
        from = new Date(now.getTime() - d * 86400000).toISOString().split('T')[0];
        to = new Date(now.getTime() + (6 - d) * 86400000).toISOString().split('T')[0];
        break;
      }
      case 'this_month':
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'next_month':
        from = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];
        break;
    }
  } else if (month && year) {
    const m = parseInt(month), y = parseInt(year);
    from = `${y}-${String(m).padStart(2, '0')}-01`;
    to = new Date(y, m, 0).toISOString().split('T')[0];
  }

  const { data: subs } = await supabaseAdmin.from('subscriptions').select('*').eq('user_id', req.userId).eq('status', 'active').gte('renewal_date', from).lte('renewal_date', to);
  const now = Date.now();
  const result = (subs ?? []).map((s, i) => ({
    id: i + 1, subscriptionId: s.id, companyName: s.company_name, companyLogoUrl: s.company_logo_url ?? null,
    amount: Number(s.monthly_price), renewalDate: s.renewal_date,
    daysUntilRenewal: Math.max(0, Math.ceil((new Date(s.renewal_date).getTime() - now) / 86400000)),
    reminderEnabled: s.reminder_enabled, reminderDaysBefore: 7,
  }));
  res.json(result);
});

router.patch('/api/renewals/:subscriptionId', requireAuth, async (req, res): Promise<void> => {
  const { subscriptionId } = req.params;
  const { reminderEnabled, reminderDaysBefore } = req.body;

  const { data, error } = await supabaseAdmin.from('subscriptions').update({ reminder_enabled: reminderEnabled, updated_at: new Date().toISOString() }).eq('id', subscriptionId).eq('user_id', req.userId).select().single();
  if (error || !data) { res.status(404).json({ error: 'Subscription not found' }); return; }

  const now = Date.now();
  res.json({
    id: 1, subscriptionId: data.id, companyName: data.company_name, companyLogoUrl: data.company_logo_url ?? null,
    amount: Number(data.monthly_price), renewalDate: data.renewal_date,
    daysUntilRenewal: Math.max(0, Math.ceil((new Date(data.renewal_date).getTime() - now) / 86400000)),
    reminderEnabled: data.reminder_enabled, reminderDaysBefore: reminderDaysBefore ?? 7,
  });
});

export default router;
