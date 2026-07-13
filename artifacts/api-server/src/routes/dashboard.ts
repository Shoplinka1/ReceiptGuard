import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { normalizeMerchantName } from './gmail';

const router: IRouter = Router();

// safeNum: converts any DB value to a finite number, treating null/undefined/NaN as 0.
const safeNum = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

// validAmount: filters out clearly malformed receipt amounts.
// Upper bound: $50,000 — anything higher is almost certainly a crypto balance,
// account value, or data-entry error that slipped through the scanner.
// Lower bound: $0.50 — sub-cent amounts are noise.
const validAmount = (v: unknown): number | null => {
  const n = safeNum(v);
  if (n < 0.50 || n > 50_000) return null;
  return n;
};

router.get('/api/dashboard/summary', requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId;
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [
    { data: profile },
    { data: receipts },
    { data: activeSubs },
    { data: warranties },
    { data: gmailAccounts },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('full_name, plan_id').eq('id', userId).single(),
    supabaseAdmin.from('receipts').select('amount, purchase_date').eq('user_id', userId),
    supabaseAdmin.from('subscriptions').select('monthly_price, yearly_price, billing_cycle, renewal_date').eq('user_id', userId).eq('status', 'active'),
    supabaseAdmin.from('warranties').select('warranty_end_date').eq('user_id', userId),
    supabaseAdmin.from('email_accounts').select('id, email').eq('user_id', userId).eq('is_active', true),
  ]);

  // Only sum receipts with valid amounts to prevent malformed data corrupting stats
  const validReceipts = (receipts ?? []).map(r => ({
    ...r,
    validAmount: validAmount(r.amount),
  })).filter(r => r.validAmount !== null);

  const monthlySpending = validReceipts
    .filter(r => r.purchase_date >= firstOfMonth)
    .reduce((sum, r) => sum + (r.validAmount ?? 0), 0);

  const upcomingRenewals = (activeSubs ?? []).filter(
    s => s.renewal_date >= today && s.renewal_date <= thirtyDaysLater
  ).length;

  const activeWarranties = (warranties ?? []).filter(w => w.warranty_end_date >= today).length;

  // Same outlier guard as receipts: a malformed/corrupted price (e.g. a
  // scraped value in the millions, or a negative number) must not corrupt
  // "Money Saved" / "Monthly Total" the way it previously could.
  const validPrice = (v: unknown): number => {
    const n = safeNum(v);
    return n < 0 || n > 50_000 ? 0 : n;
  };

  const monthlySubTotal = (activeSubs ?? []).reduce((sum, s) => {
    if (s.billing_cycle === 'yearly') return sum + validPrice(s.yearly_price) / 12;
    return sum + validPrice(s.monthly_price);
  }, 0);

  // "Money saved" = estimated savings vs. paying for each subscription month-to-month
  // at full list price, assuming an average 15% discount for annual/bundled plans.
  // Shown alongside subscriptionsMonthlyTotal so users see both the total cost
  // and the estimated savings in one view.
  const moneySaved = Math.round(monthlySubTotal * 0.15 * 100) / 100;
  // Estimated annual savings: comparison of monthly-equivalent cost vs. what
  // ad-hoc / non-subscriber pricing would cost (industry avg 20% premium).
  const annualSavings = Math.round(monthlySubTotal * 12 * 0.20 * 100) / 100;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const gmailConnected = (gmailAccounts ?? []).length > 0;

  res.json({
    firstName,
    monthlySpending: Math.round(monthlySpending * 100) / 100,
    totalReceipts: (receipts ?? []).length,
    validReceiptCount: validReceipts.length,
    activeSubscriptions: (activeSubs ?? []).length,
    upcomingRenewalsCount: upcomingRenewals,
    activeWarranties,
    moneySaved,
    annualSavings,
    subscriptionsMonthlyTotal: Math.round(monthlySubTotal * 100) / 100,
    gmailConnected,
    gmailAccounts: (gmailAccounts ?? []).map(a => ({ id: a.id, email: a.email })),
    plan: (profile?.plan_id ?? 'free') as 'free' | 'pro',
  });
});

router.get('/api/dashboard/spending-trend', requireAuth, async (req, res): Promise<void> => {
  const { data: receipts } = await supabaseAdmin
    .from('receipts')
    .select('amount, purchase_date')
    .eq('user_id', req.userId);

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const ms = String(m).padStart(2, '0');
    const first = `${y}-${ms}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const last = `${y}-${ms}-${String(lastDay).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

    const total = (receipts ?? [])
      .filter(r => r.purchase_date >= first && r.purchase_date <= last)
      .reduce((s, r) => {
        const amt = validAmount(r.amount);
        return s + (amt ?? 0);
      }, 0);

    months.push({ month: m, year: y, label, total: Math.round(total * 100) / 100, previousTotal: 0 });
  }

  // Fill in previousTotal for each month (the prior month's total)
  for (let i = 1; i < months.length; i++) {
    months[i].previousTotal = months[i - 1].total;
  }

  res.json(months);
});

router.get('/api/dashboard/top-merchants', requireAuth, async (req, res): Promise<void> => {
  const { data: receipts } = await supabaseAdmin
    .from('receipts')
    .select('merchant_name, merchant_logo_url, amount, purchase_date')
    .eq('user_id', req.userId);

  const map = new Map<string, { name: string; logo: string | null; total: number; count: number; last: string }>();

  for (const r of receipts ?? []) {
    const amt = validAmount(r.amount);
    if (amt === null) continue; // Skip malformed amounts

    // Normalize merchant name so "Amazon", "Amazon.com", "Amazon Marketplace" all
    // aggregate under the same canonical key — without this, top-merchants shows
    // duplicate entries for the same retailer with split totals.
    const key = normalizeMerchantName(r.merchant_name ?? '');
    const ex = map.get(key);
    if (ex) {
      ex.total += amt;
      ex.count++;
      if (r.purchase_date > ex.last) ex.last = r.purchase_date;
    } else {
      map.set(key, {
        name: key, logo: r.merchant_logo_url,
        total: amt, count: 1, last: r.purchase_date,
      });
    }
  }

  const result = Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((m, i) => ({
      id: i + 1,
      name: m.name,
      logoUrl: m.logo,
      totalSpent: Math.round(m.total * 100) / 100,
      purchaseCount: m.count,
      lastPurchaseDate: m.last,
    }));

  res.json(result);
});

router.get('/api/dashboard/upcoming-renewals', requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: subs } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', req.userId)
    .eq('status', 'active')
    .gte('renewal_date', today)
    .lte('renewal_date', thirtyDaysLater);

  const now = Date.now();
  const result = (subs ?? []).map((s, i) => ({
    id: i + 1,
    subscriptionId: s.id,
    companyName: s.name ?? s.company_name,
    companyLogoUrl: s.company_logo_url ?? null,
    amount: s.billing_cycle === 'yearly' ? safeNum(s.yearly_price) : safeNum(s.monthly_price),
    renewalDate: s.renewal_date,
    daysUntilRenewal: Math.max(0, Math.ceil((new Date(s.renewal_date).getTime() - now) / 86400000)),
    reminderEnabled: s.reminder_enabled,
    reminderDaysBefore: 7,
  }));
  res.json(result);
});

export default router;
