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
    { data: settings },
    { data: receipts },
    { data: activeSubs },
    { data: warranties },
    { data: gmailAccounts },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('full_name, plan_id').eq('id', userId).single(),
    supabaseAdmin.from('settings').select('currency').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('receipts').select('amount, currency, purchase_date').eq('user_id', userId),
    supabaseAdmin.from('subscriptions').select('monthly_price, yearly_price, currency, billing_cycle, renewal_date').eq('user_id', userId).eq('status', 'active'),
    supabaseAdmin.from('warranties').select('warranty_end_date').eq('user_id', userId),
    supabaseAdmin.from('email_accounts').select('id, email').eq('user_id', userId).eq('is_active', true),
  ]);

  // The dashboard's headline numbers (monthlySpending, subscriptionsMonthlyTotal,
  // etc.) are reported in the user's preferred currency ("primary currency").
  // Receipts/subscriptions recorded in OTHER currencies (e.g. a Flutterwave
  // charge in NGN) are never summed into those primary-currency totals —
  // treating ₦30,000 as $30,000 would massively inflate spending. But per the
  // requirement that no valid receipt be discarded, every currency present is
  // also summed separately and returned in `currencyBreakdown`, so a user with
  // mixed-currency receipts can see ALL of their spending, grouped correctly.
  const primaryCurrency = (settings?.currency ?? 'USD').toUpperCase();
  const currencyOf = (c: unknown) => (typeof c === 'string' && c.trim() ? c.toUpperCase() : 'USD');
  const isPrimaryCurrency = (c: unknown) => currencyOf(c) === primaryCurrency;

  // validReceiptCount is a currency-agnostic COUNT (not a sum), so it is
  // computed over every currency — only amount validity matters here. Only
  // the actual monthlySpending SUM below is restricted to the primary
  // currency, to avoid mixing currencies in a total.
  const allValidReceipts = (receipts ?? []).map(r => ({
    ...r,
    validAmount: validAmount(r.amount),
  })).filter(r => r.validAmount !== null);

  const validReceipts = allValidReceipts.filter(r => isPrimaryCurrency(r.currency));

  const monthlySpending = validReceipts
    .filter(r => r.purchase_date >= firstOfMonth)
    .reduce((sum, r) => sum + (r.validAmount ?? 0), 0);

  // upcomingRenewals count spans ALL currencies (it's a count, not a sum, so
  // there is no currency-mixing risk) — matches the full list returned by
  // /api/dashboard/upcoming-renewals.
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

  const monthlySubTotal = (activeSubs ?? [])
    .filter(s => isPrimaryCurrency(s.currency))
    .reduce((sum, s) => {
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

  // currencyBreakdown: monthly spending + receipt count for every currency
  // present in this user's receipts, not just the primary one. No exchange
  // rate is applied — each bucket is the literal sum in that currency. This
  // is how "don't discard non-primary-currency receipts" is satisfied without
  // risking a currency-mixed total.
  const breakdownMap = new Map<string, { monthlySpending: number; totalSpending: number; receiptCount: number }>();
  for (const r of receipts ?? []) {
    const cur = currencyOf(r.currency);
    const amt = validAmount(r.amount);
    if (amt === null) continue;
    const bucket = breakdownMap.get(cur) ?? { monthlySpending: 0, totalSpending: 0, receiptCount: 0 };
    bucket.totalSpending += amt;
    bucket.receiptCount += 1;
    if (r.purchase_date >= firstOfMonth) bucket.monthlySpending += amt;
    breakdownMap.set(cur, bucket);
  }
  const currencyBreakdown = Array.from(breakdownMap.entries())
    .map(([currency, v]) => ({
      currency,
      monthlySpending: Math.round(v.monthlySpending * 100) / 100,
      totalSpending: Math.round(v.totalSpending * 100) / 100,
      receiptCount: v.receiptCount,
    }))
    .sort((a, b) => (a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0));

  // Same non-discarding treatment for active-subscription monthly cost:
  // subscriptionsMonthlyTotal above is primary-currency only; every other
  // currency present among active subscriptions is summed here instead of
  // being silently dropped from the response.
  const subBreakdownMap = new Map<string, number>();
  for (const s of activeSubs ?? []) {
    const cur = currencyOf(s.currency);
    if (cur === primaryCurrency) continue;
    const monthly = s.billing_cycle === 'yearly' ? validPrice(s.yearly_price) / 12 : validPrice(s.monthly_price);
    subBreakdownMap.set(cur, (subBreakdownMap.get(cur) ?? 0) + monthly);
  }
  const subscriptionCurrencyBreakdown = Array.from(subBreakdownMap.entries()).map(([currency, total]) => ({
    currency, monthlyTotal: Math.round(total * 100) / 100,
  }));

  res.json({
    firstName,
    monthlySpending: Math.round(monthlySpending * 100) / 100,
    totalReceipts: (receipts ?? []).length,
    validReceiptCount: allValidReceipts.length,
    activeSubscriptions: (activeSubs ?? []).length,
    upcomingRenewalsCount: upcomingRenewals,
    activeWarranties,
    moneySaved,
    annualSavings,
    subscriptionsMonthlyTotal: Math.round(monthlySubTotal * 100) / 100,
    gmailConnected,
    gmailAccounts: (gmailAccounts ?? []).map(a => ({ id: a.id, email: a.email })),
    plan: (profile?.plan_id ?? 'free') as 'free' | 'pro',
    currency: primaryCurrency,
    currencyBreakdown,
    subscriptionCurrencyBreakdown,
  });
});

router.get('/api/dashboard/spending-trend', requireAuth, async (req, res): Promise<void> => {
  const [{ data: receipts }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('receipts').select('amount, currency, purchase_date').eq('user_id', req.userId),
    supabaseAdmin.from('settings').select('currency').eq('user_id', req.userId).maybeSingle(),
  ]);
  const primaryCurrency = (settings?.currency ?? 'USD').toUpperCase();
  const currencyOf = (c: unknown) => (typeof c === 'string' && c.trim() ? c.toUpperCase() : 'USD');
  const isPrimaryCurrency = (c: unknown) => currencyOf(c) === primaryCurrency;

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

    const monthReceipts = (receipts ?? []).filter(r => r.purchase_date >= first && r.purchase_date <= last);

    const total = monthReceipts
      .filter(r => isPrimaryCurrency(r.currency))
      .reduce((s, r) => {
        const amt = validAmount(r.amount);
        return s + (amt ?? 0);
      }, 0);

    // Per the "don't discard other currencies" requirement, also report each
    // non-primary currency's total for this month separately (never merged
    // into `total`) so the trend can still show all spending if the UI wants it.
    const otherMap = new Map<string, number>();
    for (const r of monthReceipts) {
      const cur = currencyOf(r.currency);
      if (cur === primaryCurrency) continue;
      const amt = validAmount(r.amount);
      if (amt === null) continue;
      otherMap.set(cur, (otherMap.get(cur) ?? 0) + amt);
    }
    const otherCurrencyTotals = Array.from(otherMap.entries()).map(([currency, t]) => ({
      currency, total: Math.round(t * 100) / 100,
    }));

    months.push({
      month: m, year: y, label,
      total: Math.round(total * 100) / 100,
      previousTotal: 0,
      otherCurrencyTotals,
    });
  }

  // Fill in previousTotal for each month (the prior month's total)
  for (let i = 1; i < months.length; i++) {
    months[i].previousTotal = months[i - 1].total;
  }

  res.json(months);
});

router.get('/api/dashboard/top-merchants', requireAuth, async (req, res): Promise<void> => {
  const [{ data: receipts }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('receipts').select('merchant_name, merchant_logo_url, amount, currency, purchase_date').eq('user_id', req.userId),
    supabaseAdmin.from('settings').select('currency').eq('user_id', req.userId).maybeSingle(),
  ]);
  const primaryCurrency = (settings?.currency ?? 'USD').toUpperCase();
  const currencyOf = (c: unknown) => (typeof c === 'string' && c.trim() ? c.toUpperCase() : 'USD');

  // Group by merchant name AND currency — a merchant can legitimately be
  // charged in more than one currency (e.g. Amazon US in USD vs Amazon UK in
  // GBP), and those must never be summed into one total. Non-primary-currency
  // merchant totals are still returned (isPrimary: false) rather than dropped,
  // so no valid receipt is discarded — the ranking/"top 8" is computed on the
  // primary-currency totals only, matching the rest of the dashboard.
  const map = new Map<string, { name: string; logo: string | null; total: number; count: number; last: string; currency: string }>();

  for (const r of receipts ?? []) {
    const amt = validAmount(r.amount);
    if (amt === null) continue; // Skip malformed amounts

    // Normalize merchant name so "Amazon", "Amazon.com", "Amazon Marketplace" all
    // aggregate under the same canonical key — without this, top-merchants shows
    // duplicate entries for the same retailer with split totals.
    const name = normalizeMerchantName(r.merchant_name ?? '');
    const currency = currencyOf(r.currency);
    const key = `${name}::${currency}`;
    const ex = map.get(key);
    if (ex) {
      ex.total += amt;
      ex.count++;
      if (r.purchase_date > ex.last) ex.last = r.purchase_date;
    } else {
      map.set(key, {
        name, logo: r.merchant_logo_url,
        total: amt, count: 1, last: r.purchase_date, currency,
      });
    }
  }

  // Response stays an array (same shape as before, for API-client compatibility)
  // but now spans every currency instead of dropping non-primary ones: primary-
  // currency merchants are ranked and capped at the usual top 8, then any
  // non-primary-currency merchants are appended (marked isPrimary: false) so
  // they are visible rather than silently discarded, per currency-safety rules.
  const primaryMerchants = Array.from(map.values()).filter(m => m.currency === primaryCurrency);
  const otherMerchants = Array.from(map.values()).filter(m => m.currency !== primaryCurrency);

  const toItem = (m: typeof primaryMerchants[number], i: number, isPrimary: boolean) => ({
    id: i + 1,
    name: m.name,
    logoUrl: m.logo,
    totalSpent: Math.round(m.total * 100) / 100,
    purchaseCount: m.count,
    lastPurchaseDate: m.last,
    currency: m.currency,
    isPrimary,
  });

  const result = [
    ...primaryMerchants.sort((a, b) => b.total - a.total).slice(0, 8).map((m, i) => toItem(m, i, true)),
    ...otherMerchants.sort((a, b) => b.total - a.total).map((m, i) => toItem(m, i, false)),
  ];

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

  // Renewals are individual line items, not a summed total, so there is no
  // currency-mixing risk here — every renewal is returned with its own
  // `currency` field regardless of the user's primary currency, matching the
  // "don't discard non-primary-currency subscriptions" requirement.
  const now = Date.now();
  const result = (subs ?? []).map((s, i) => ({
    id: i + 1,
    subscriptionId: s.id,
    companyName: s.name ?? s.company_name,
    companyLogoUrl: s.company_logo_url ?? null,
    amount: s.billing_cycle === 'yearly' ? safeNum(s.yearly_price) : safeNum(s.monthly_price),
    currency: (typeof s.currency === 'string' && s.currency.trim() ? s.currency.toUpperCase() : 'USD'),
    renewalDate: s.renewal_date,
    daysUntilRenewal: Math.max(0, Math.ceil((new Date(s.renewal_date).getTime() - now) / 86400000)),
    reminderEnabled: s.reminder_enabled,
    reminderDaysBefore: 7,
  }));
  res.json(result);
});

export default router;
