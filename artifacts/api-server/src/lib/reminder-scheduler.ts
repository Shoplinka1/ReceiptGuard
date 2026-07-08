/**
 * Renewal Reminder & Warranty Scheduler
 *
 * Runs every hour and:
 *   1. Sends renewal reminders for subscriptions renewing in days matching the
 *      user's enabled reminder windows (30/14/7/3/1).
 *   2. Sends warranty expiry reminders for warranties expiring in those same windows.
 *   3. Auto-downgrades users whose billing period has ended.
 *   4. Rescans connected Gmail accounts once per day for new receipts.
 *
 * All reminders respect the user's email_notifications setting.
 * Deduplication: at most one notification per (type, reference, day-window) per calendar day.
 */
import { supabaseAdmin } from './supabase';
import { sendEmail } from './email';
import { logger } from './logger';
import { runGmailScan } from '../routes/gmail';

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Day windows we check. Must match the settings column names.
const REMINDER_WINDOWS: { days: number; settingKey: string }[] = [
  { days: 30, settingKey: 'days_before_30' },
  { days: 14, settingKey: 'days_before_14' },
  { days: 7,  settingKey: 'days_before_7' },
  { days: 3,  settingKey: 'days_before_3' },
  { days: 1,  settingKey: 'days_before_1' },
];

// ─── Email templates ─────────────────────────────────────────────────────────

function reminderEmailHtml(opts: {
  firstName: string; companyName: string; amount: number; currency: string;
  renewalDate: string; appUrl: string; daysAway: number; type: 'renewal' | 'warranty';
}): string {
  const { firstName, companyName, amount, currency, renewalDate, appUrl, daysAway, type } = opts;
  const isWarranty = type === 'warranty';
  const daysLabel = daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`;
  const heading = isWarranty
    ? `Warranty expires ${daysLabel}`
    : `Subscription renewing ${daysLabel}`;
  const actionUrl = isWarranty ? `${appUrl}/warranties` : `${appUrl}/subscriptions`;
  const actionLabel = isWarranty ? 'View Warranties' : 'View Subscriptions';
  const detail = isWarranty
    ? `Expires on <strong>${renewalDate}</strong>`
    : `Renews on <strong>${renewalDate}</strong> for <strong>${currency} ${amount.toFixed(2)}</strong>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <tr>
      <td style="background:#10b981;padding:28px 32px;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">ReceiptGuard</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">${heading}</h2>
        <p style="margin:0 0 24px;color:#6b7280;">Hi ${firstName}, just a heads-up:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;">${companyName}</p>
              <p style="margin:0;color:#6b7280;font-size:15px;">${detail}</p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 24px;color:#374151;font-size:15px;">
          Head to your ReceiptGuard dashboard to review or take action.
        </p>
        <a href="${actionUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
          ${actionLabel}
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">
          You're receiving this because you have a ReceiptGuard account.
          <a href="${appUrl}/reminders" style="color:#10b981;">Manage notifications</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function targetDateRange(daysAway: number): { start: string; end: string } {
  const target = new Date();
  target.setDate(target.getDate() + daysAway);
  const dayStart = new Date(target); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(target); dayEnd.setHours(23, 59, 59, 999);
  return { start: dayStart.toISOString(), end: dayEnd.toISOString() };
}

async function alreadyNotifiedToday(userId: string, type: string, refId: string, daysAway: number): Promise<boolean> {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const { data } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .contains('metadata', { refId, daysAway })
    .gte('created_at', todayStart.toISOString())
    .maybeSingle();
  return !!data;
}

// ─── Renewal reminders ───────────────────────────────────────────────────────

async function runRenewalRemindersForWindow(daysAway: number, appUrl: string): Promise<void> {
  const { start, end } = targetDateRange(daysAway);

  const { data: renewals, error } = await supabaseAdmin
    .from('renewals')
    .select('id, user_id, merchant_name, amount, currency, renewal_date, subscription_id')
    .eq('status', 'upcoming')
    .gte('renewal_date', start)
    .lte('renewal_date', end);

  if (error) { logger.error({ error, daysAway }, '[reminders] renewals fetch failed'); return; }
  if (!renewals?.length) return;

  for (const renewal of renewals) {
    // Check if user has renewal_reminder enabled and this window enabled
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('renewal_reminder, email_notifications, days_before_30, days_before_14, days_before_7, days_before_3, days_before_1')
      .eq('user_id', renewal.user_id)
      .maybeSingle();

    if (settings?.renewal_reminder === false) continue;

    // Check the specific day-window is enabled (default true)
    const windowKey = `days_before_${daysAway}` as keyof typeof settings;
    if (settings && settings[windowKey] === false) continue;

    if (await alreadyNotifiedToday(renewal.user_id, 'renewal_reminder', renewal.id, daysAway)) continue;

    const renewalDateFormatted = new Date(renewal.renewal_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    await supabaseAdmin.from('notifications').insert({
      user_id: renewal.user_id, type: 'renewal_reminder',
      title: `${renewal.merchant_name} renews ${daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}`,
      body: `Your ${renewal.merchant_name} subscription (${renewal.currency ?? 'USD'} ${Number(renewal.amount).toFixed(2)}) renews on ${renewalDateFormatted}.`,
      is_read: false,
      metadata: { refId: renewal.id, daysAway, subscriptionId: renewal.subscription_id, merchantName: renewal.merchant_name, renewalDate: renewal.renewal_date },
    });

    if (settings?.email_notifications === false) continue;

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', renewal.user_id).single();
    if (!profile?.email) continue;

    await sendEmail({
      to: profile.email,
      subject: `Reminder: ${renewal.merchant_name} renews in ${daysAway} day${daysAway === 1 ? '' : 's'}`,
      html: reminderEmailHtml({
        firstName: profile.full_name?.split(' ')[0] ?? 'there',
        companyName: renewal.merchant_name, amount: Number(renewal.amount),
        currency: renewal.currency ?? 'USD', renewalDate: renewalDateFormatted,
        appUrl, daysAway, type: 'renewal',
      }),
      text: `Hi ${profile.full_name?.split(' ')[0] ?? 'there'},\n\nYour ${renewal.merchant_name} subscription (${renewal.currency ?? 'USD'} ${Number(renewal.amount).toFixed(2)}) renews on ${renewalDateFormatted}.\n\nManage at ${appUrl}/subscriptions`,
    });
  }
}

// ─── Warranty reminders ──────────────────────────────────────────────────────

async function runWarrantyRemindersForWindow(daysAway: number, appUrl: string): Promise<void> {
  const { start, end } = targetDateRange(daysAway);

  const { data: warranties, error } = await supabaseAdmin
    .from('warranties')
    .select('id, user_id, product_name, merchant_name, warranty_end_date')
    .eq('status', 'active')
    .gte('warranty_end_date', start)
    .lte('warranty_end_date', end);

  if (error) { logger.error({ error, daysAway }, '[reminders] warranties fetch failed'); return; }
  if (!warranties?.length) return;

  for (const warranty of warranties) {
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('warranty_reminder, email_notifications, days_before_30, days_before_14, days_before_7, days_before_3, days_before_1')
      .eq('user_id', warranty.user_id)
      .maybeSingle();

    if (settings?.warranty_reminder === false) continue;

    const windowKey = `days_before_${daysAway}` as keyof typeof settings;
    if (settings && settings[windowKey] === false) continue;

    if (await alreadyNotifiedToday(warranty.user_id, 'warranty_reminder', warranty.id, daysAway)) continue;

    const expiryFormatted = new Date(warranty.warranty_end_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const name = warranty.product_name;

    await supabaseAdmin.from('notifications').insert({
      user_id: warranty.user_id, type: 'warranty_reminder',
      title: `${name} warranty expires ${daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}`,
      body: `The warranty for ${name} (from ${warranty.merchant_name ?? 'unknown merchant'}) expires on ${expiryFormatted}.`,
      is_read: false,
      metadata: { refId: warranty.id, daysAway, productName: name, warrantyEndDate: warranty.warranty_end_date },
    });

    if (settings?.email_notifications === false) continue;

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', warranty.user_id).single();
    if (!profile?.email) continue;

    await sendEmail({
      to: profile.email,
      subject: `Warranty alert: ${name} expires in ${daysAway} day${daysAway === 1 ? '' : 's'}`,
      html: reminderEmailHtml({
        firstName: profile.full_name?.split(' ')[0] ?? 'there',
        companyName: name, amount: 0,
        currency: 'USD', renewalDate: expiryFormatted,
        appUrl, daysAway, type: 'warranty',
      }),
      text: `Hi ${profile.full_name?.split(' ')[0] ?? 'there'},\n\nThe warranty for ${name} expires on ${expiryFormatted}.\n\nView at ${appUrl}/warranties`,
    });
  }
}

// ─── Expiry downgrade ─────────────────────────────────────────────────────────

async function runExpiryDowngrade(): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { data: expired, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id, user_id')
      .eq('status', 'active')
      .lte('current_period_end', now);

    if (error) { logger.error({ error }, '[reminders] Expiry check failed'); return; }
    if (!expired?.length) return;

    logger.info({ count: expired.length }, '[reminders] Downgrading expired subscriptions');
    for (const sub of expired) {
      await supabaseAdmin.from('user_subscriptions').update({ status: 'expired' }).eq('id', sub.id);
      await supabaseAdmin.from('profiles').update({ plan_id: 'free' }).eq('id', sub.user_id);
      await supabaseAdmin.from('activity_logs').insert({
        user_id: sub.user_id, type: 'plan_downgraded',
        description: 'Subscription expired — downgraded to Free plan automatically.',
      });
      logger.info({ userId: sub.user_id }, '[reminders] Downgraded to free on expiry');
    }
  } catch (err) {
    logger.error({ err }, '[reminders] Expiry downgrade error');
  }
}

// ─── Gmail periodic rescan ────────────────────────────────────────────────────
// Runs daily: rescans accounts not scanned in the last 23 hours for new emails.

async function runGmailRescan(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const { data: accounts, error } = await supabaseAdmin
      .from('email_accounts')
      .select('*')
      .eq('is_active', true)
      .or(`last_scanned_at.is.null,last_scanned_at.lte.${cutoff}`);

    if (error) { logger.error({ error }, '[gmail-rescan] Failed to fetch accounts'); return; }
    if (!accounts?.length) { logger.debug('[gmail-rescan] All accounts scanned recently'); return; }

    logger.info({ count: accounts.length }, '[gmail-rescan] Starting periodic inbox rescan');

    // Run scans sequentially to avoid hammering Gmail API
    for (const account of accounts) {
      try {
        logger.info({ email: account.email }, '[gmail-rescan] Rescanning account');
        await runGmailScan(account, account.user_id, false);
      } catch (scanErr: any) {
        logger.warn({ email: account.email, err: scanErr.message }, '[gmail-rescan] Scan failed for account');
      }
    }
  } catch (err) {
    logger.error({ err }, '[gmail-rescan] Error');
  }
}

// ─── Main check ──────────────────────────────────────────────────────────────

async function runAllReminders(): Promise<void> {
  const appUrl = process.env.FRONTEND_URL ?? 'https://receiptguard.app';
  try {
    // Run all reminder windows in parallel
    await Promise.all([
      ...REMINDER_WINDOWS.map(w => runRenewalRemindersForWindow(w.days, appUrl)),
      ...REMINDER_WINDOWS.map(w => runWarrantyRemindersForWindow(w.days, appUrl)),
    ]);
    logger.debug('[reminders] Reminder check complete');
  } catch (err) {
    logger.error({ err }, '[reminders] Scheduler error');
  }
}

// ─── Scheduler entry ─────────────────────────────────────────────────────────

let runCount = 0;

export function startReminderScheduler(): void {
  logger.info('[reminders] Scheduler started — checking every hour');

  const tick = async () => {
    runCount++;
    await runAllReminders();
    await runExpiryDowngrade();
    // Gmail rescan runs every 24 ticks (approximately once per day)
    if (runCount % 24 === 1) await runGmailRescan();
  };

  // Run immediately on startup, then every hour
  tick();
  setInterval(tick, INTERVAL_MS);
}
