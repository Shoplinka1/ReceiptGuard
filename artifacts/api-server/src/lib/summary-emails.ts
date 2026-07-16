/**
 * Weekly / monthly / yearly spending summary emails.
 *
 * Checked once per day (called from reminder-scheduler.ts's daily tick):
 *   - Weekly:  sent every Monday, covering the previous 7 days (Mon–Sun).
 *   - Monthly: sent on the 1st of each month, covering the previous calendar month.
 *   - Yearly:  sent on Jan 1, covering the previous calendar year.
 *
 * Only sent to users who had at least one receipt in the period (no "you
 * spent $0" noise). Respects settings.email_notifications. Deduplicated via
 * a `notifications` row per (user, type, periodKey) so a mid-day restart on
 * the same day never double-sends.
 */
import { supabaseAdmin } from './supabase';
import { sendEmail, EMAIL_SENDERS } from './email';
import { logger } from './logger';

type Period = 'weekly' | 'monthly' | 'yearly';

function periodLabel(period: Period): string {
  return period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Yearly';
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtMoney(n: number, currency: string): string {
  return `${currency} ${n.toFixed(2)}`;
}

// ─── Period ranges ──────────────────────────────────────────────────────────────

function weeklyRange(now: Date): { start: Date; end: Date; periodKey: string } {
  const end = new Date(now); end.setUTCHours(0, 0, 0, 0); end.setUTCDate(end.getUTCDate() - 1); // yesterday (Sunday)
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6); // 7 days total
  return { start, end, periodKey: `weekly-${fmtDate(start)}` };
}

function monthlyRange(now: Date): { start: Date; end: Date; periodKey: string } {
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(firstOfThisMonth); end.setUTCDate(end.getUTCDate() - 1); // last day of previous month
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return { start, end, periodKey: `monthly-${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}` };
}

function yearlyRange(now: Date): { start: Date; end: Date; periodKey: string } {
  const year = now.getUTCFullYear() - 1;
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)), periodKey: `yearly-${year}` };
}

// ─── Dedup ───────────────────────────────────────────────────────────────────────

async function alreadySent(userId: string, type: string, periodKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .contains('metadata', { periodKey })
    .maybeSingle();
  return !!data;
}

// ─── Data ────────────────────────────────────────────────────────────────────────

export async function usersWithReceiptsInRange(start: Date, end: Date): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('receipts')
    .select('user_id')
    .gte('purchase_date', fmtDate(start))
    .lte('purchase_date', fmtDate(end));
  if (error) { logger.error({ error }, '[summary-emails] Failed to load users with receipts in range'); return []; }
  return [...new Set((data ?? []).map((r: any) => r.user_id as string))];
}

export async function computeSummary(userId: string, start: Date, end: Date) {
  const { data: receipts } = await supabaseAdmin
    .from('receipts')
    .select('amount, category, merchant_name, currency')
    .eq('user_id', userId)
    .gte('purchase_date', fmtDate(start))
    .lte('purchase_date', fmtDate(end));

  const rows = receipts ?? [];
  const currency = rows[0]?.currency ?? 'USD';
  const total = rows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  const byCategory: Record<string, number> = {};
  const byMerchant: Record<string, number> = {};
  for (const r of rows) {
    byCategory[r.category ?? 'other'] = (byCategory[r.category ?? 'other'] ?? 0) + Number(r.amount ?? 0);
    byMerchant[r.merchant_name] = (byMerchant[r.merchant_name] ?? 0) + Number(r.amount ?? 0);
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topMerchants = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const { data: subs } = await supabaseAdmin.from('subscriptions').select('monthly_price').eq('user_id', userId).eq('status', 'active');
  const subsMonthlyTotal = (subs ?? []).reduce((s: number, r: any) => s + Number(r.monthly_price ?? 0), 0);

  return { currency, total, receiptCount: rows.length, topCategories, topMerchants, subsMonthlyTotal };
}

// ─── Template ───────────────────────────────────────────────────────────────────

export function summaryEmailHtml(opts: {
  firstName: string; period: Period; start: Date; end: Date; appUrl: string;
  currency: string; total: number; receiptCount: number;
  topCategories: [string, number][]; topMerchants: [string, number][]; subsMonthlyTotal: number;
}): string {
  const { firstName, period, start, end, appUrl, currency, total, receiptCount, topCategories, topMerchants, subsMonthlyTotal } = opts;
  const rangeLabel = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const rowsHtml = (label: string, entries: [string, number][]) => entries.length ? `
    <p style="margin:16px 0 6px;font-weight:600;color:#111827;font-size:14px;">${label}</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${entries.map(([name, amt]) => `
        <tr>
          <td style="padding:4px 0;color:#374151;font-size:14px;">${name}</td>
          <td style="padding:4px 0;color:#111827;font-size:14px;text-align:right;font-weight:600;">${fmtMoney(amt, currency)}</td>
        </tr>`).join('')}
    </table>` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${periodLabel(period)} spending summary</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <tr>
      <td style="background:#10b981;padding:28px 32px;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">ReceiptGuard</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 4px;font-size:22px;color:#111827;">Your ${periodLabel(period).toLowerCase()} summary</h2>
        <p style="margin:0 0 24px;color:#6b7280;">Hi ${firstName}, here's what happened ${rangeLabel}:</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:8px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 4px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">Total spent</p>
              <p style="margin:0;font-size:28px;font-weight:700;color:#111827;">${fmtMoney(total, currency)}</p>
              <p style="margin:6px 0 0;color:#6b7280;font-size:13px;">${receiptCount} receipt${receiptCount === 1 ? '' : 's'} tracked${subsMonthlyTotal > 0 ? ` · ${fmtMoney(subsMonthlyTotal, currency)}/mo in active subscriptions` : ''}</p>
            </td>
          </tr>
        </table>

        ${rowsHtml('Top categories', topCategories)}
        ${rowsHtml('Top merchants', topMerchants)}

        <a href="${appUrl}/dashboard" style="display:inline-block;margin-top:24px;background:#10b981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
          View full dashboard
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">
          You're receiving this because you have a ReceiptGuard account.
          <a href="${appUrl}/settings?tab=general" style="color:#10b981;">Manage email preferences</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Runner ──────────────────────────────────────────────────────────────────────

async function runPeriod(period: Period, range: { start: Date; end: Date; periodKey: string }, appUrl: string): Promise<void> {
  const userIds = await usersWithReceiptsInRange(range.start, range.end);
  if (!userIds.length) { logger.debug({ period }, '[summary-emails] No users had activity in this period'); return; }

  const notificationType = `${period}_summary`;
  let sent = 0, skipped = 0;

  for (const userId of userIds) {
    if (await alreadySent(userId, notificationType, range.periodKey)) { skipped++; continue; }

    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('email_notifications, weekly_summary, monthly_summary, yearly_summary')
      .eq('user_id', userId)
      .maybeSingle();

    if (settings?.email_notifications === false) continue;
    // Per-period opt-out columns may not exist on every DB yet (added in
    // migration Phase 5's siblings) — absence means "enabled" (safe default).
    const periodSettingKey = `${period}_summary` as keyof typeof settings;
    if (settings && settings[periodSettingKey] === false) continue;

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
    if (!profile?.email) continue;

    const summary = await computeSummary(userId, range.start, range.end);
    if (summary.receiptCount === 0) continue; // don't send an empty summary

    const firstName = profile.full_name?.split(' ')[0] ?? 'there';
    const sentOk = await sendEmail({
      to: profile.email,
      from: EMAIL_SENDERS.noreply,
      subject: `Your ${periodLabel(period).toLowerCase()} ReceiptGuard summary: ${fmtMoney(summary.total, summary.currency)} tracked`,
      html: summaryEmailHtml({ firstName, period, start: range.start, end: range.end, appUrl, ...summary }),
      text: `Hi ${firstName},\n\nYour ${period} summary (${fmtDate(range.start)} to ${fmtDate(range.end)}): ${fmtMoney(summary.total, summary.currency)} across ${summary.receiptCount} receipts.\n\nView details at ${appUrl}/dashboard`,
    });

    await supabaseAdmin.from('notifications').insert({
      user_id: userId, type: notificationType,
      title: `Your ${periodLabel(period).toLowerCase()} summary is ready`,
      body: `${fmtMoney(summary.total, summary.currency)} tracked across ${summary.receiptCount} receipts.`,
      is_read: false,
      metadata: { periodKey: range.periodKey, total: summary.total, receiptCount: summary.receiptCount, emailSent: sentOk },
    });

    if (sentOk) sent++;
    else logger.warn({ userId, period }, '[summary-emails] Email delivery failed for summary');
  }

  logger.info({ period, candidateUsers: userIds.length, sent, skippedAlreadySent: skipped }, '[summary-emails] period complete');
}

export async function runSummaryEmails(): Promise<void> {
  const appUrl = process.env.FRONTEND_URL ?? 'https://receiptguard.app';
  const now = new Date();
  try {
    if (now.getUTCDay() === 1) await runPeriod('weekly', weeklyRange(now), appUrl); // Monday
    if (now.getUTCDate() === 1) await runPeriod('monthly', monthlyRange(now), appUrl); // 1st of month
    if (now.getUTCDate() === 1 && now.getUTCMonth() === 0) await runPeriod('yearly', yearlyRange(now), appUrl); // Jan 1
  } catch (err) {
    logger.error({ err }, '[summary-emails] scheduler error');
  }
}
