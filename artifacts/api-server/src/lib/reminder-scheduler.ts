/**
 * Renewal Reminder & Warranty Scheduler
 *
 * Runs every hour and:
 *   1. Sends renewal reminders for subscriptions renewing in days matching the
 *      user's enabled reminder windows (30/14/7/3/1).
 *   2. Sends warranty expiry reminders for warranties expiring in those same windows.
 *   3. Auto-downgrades users whose billing period has ended.
 *   4. Once per day, checks whether it's time to send weekly/monthly/yearly
 *      spending summary emails (see summary-emails.ts).
 *
 * Automatic Gmail rescanning is a separate scheduler — see gmail-scheduler.ts.
 *
 * All reminders respect the user's email_notifications setting.
 * Deduplication: at most one notification per (type, reference, day-window) per calendar day.
 * Timezone: reminders are scheduled in UTC. Per-user timezone is stored in settings
 * but scheduling in individual timezones would require a per-user job queue.
 * The current approach fires reminders within ±12 hours of the user's local date.
 */
import { supabaseAdmin } from './supabase';
import { sendEmail, EMAIL_SENDERS } from './email';
import { logger } from './logger';
import { runSummaryEmails } from './summary-emails';

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Reminder windows for subscription renewals
const RENEWAL_REMINDER_WINDOWS: { days: number; settingKey: string }[] = [
  { days: 30, settingKey: 'days_before_30' },
  { days: 14, settingKey: 'days_before_14' },
  { days: 7,  settingKey: 'days_before_7' },
  { days: 3,  settingKey: 'days_before_3' },
  { days: 1,  settingKey: 'days_before_1' },
];

// Warranty reminders include longer lead times (90/60 days) because users need
// more notice to act on warranty claims before the window closes. 90/60 don't
// have dedicated settings columns — if the column is absent the setting is
// treated as "enabled" (the safe default), so existing users aren't silently
// skipped for the new windows.
const WARRANTY_REMINDER_WINDOWS: { days: number; settingKey: string }[] = [
  { days: 90, settingKey: 'days_before_90' },
  { days: 60, settingKey: 'days_before_60' },
  { days: 30, settingKey: 'days_before_30' },
  { days: 14, settingKey: 'days_before_14' },
  { days: 7,  settingKey: 'days_before_7' },
  { days: 3,  settingKey: 'days_before_3' },
  { days: 1,  settingKey: 'days_before_1' },
];

// ─── Email templates ──────────────────────────────────────────────────────────

export function reminderEmailHtml(opts: {
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
          <a href="${appUrl}/settings?tab=reminders" style="color:#10b981;">Manage notifications</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Renewal reminders ────────────────────────────────────────────────────────

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
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('renewal_reminder, email_notifications, days_before_30, days_before_14, days_before_7, days_before_3, days_before_1')
      .eq('user_id', renewal.user_id)
      .maybeSingle();

    if (settings?.renewal_reminder === false) continue;

    const windowKey = `days_before_${daysAway}` as keyof typeof settings;
    if (settings && settings[windowKey] === false) continue;

    // Deduplicate: skip if already notified today for this exact (type, ref, window)
    if (await alreadyNotifiedToday(renewal.user_id, 'renewal_reminder', renewal.id, daysAway)) continue;

    const renewalDateFormatted = new Date(renewal.renewal_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      user_id: renewal.user_id, type: 'renewal_reminder',
      title: `${renewal.merchant_name} renews ${daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}`,
      body: `Your ${renewal.merchant_name} subscription (${renewal.currency ?? 'USD'} ${Number(renewal.amount).toFixed(2)}) renews on ${renewalDateFormatted}.`,
      is_read: false,
      metadata: { refId: renewal.id, daysAway, subscriptionId: renewal.subscription_id, merchantName: renewal.merchant_name, renewalDate: renewal.renewal_date },
    });

    if (notifError) {
      logger.error({ err: notifError, renewalId: renewal.id }, '[reminders] notification insert failed');
    }

    if (settings?.email_notifications === false) continue;

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', renewal.user_id).single();
    if (!profile?.email) continue;

    const sent = await sendEmail({
      to: profile.email,
      from: EMAIL_SENDERS.reminders,
      subject: `Reminder: ${renewal.merchant_name} renews in ${daysAway} day${daysAway === 1 ? '' : 's'}`,
      html: reminderEmailHtml({
        firstName: profile.full_name?.split(' ')[0] ?? 'there',
        companyName: renewal.merchant_name, amount: Number(renewal.amount),
        currency: renewal.currency ?? 'USD', renewalDate: renewalDateFormatted,
        appUrl, daysAway, type: 'renewal',
      }),
      text: `Hi ${profile.full_name?.split(' ')[0] ?? 'there'},\n\nYour ${renewal.merchant_name} subscription (${renewal.currency ?? 'USD'} ${Number(renewal.amount).toFixed(2)}) renews on ${renewalDateFormatted}.\n\nManage at ${appUrl}/subscriptions`,
    });

    if (sent) {
      // Write to activity_logs so the diagnostics endpoint can confirm the
      // scheduler is running — it looks for 'reminder_sent' entries within 2h.
      void supabaseAdmin.from('activity_logs').insert({
        user_id: renewal.user_id, type: 'reminder_sent',
        description: `Renewal reminder for ${renewal.merchant_name} sent (${daysAway}d window)`,
      }).then(undefined, () => {});
    } else {
      logger.warn({ userId: renewal.user_id, merchantName: renewal.merchant_name }, '[reminders] Email delivery failed for renewal reminder');
    }
  }
}

// ─── Warranty reminders ───────────────────────────────────────────────────────

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

    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      user_id: warranty.user_id, type: 'warranty_reminder',
      title: `${name} warranty expires ${daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}`,
      body: `The warranty for ${name} (from ${warranty.merchant_name ?? 'unknown merchant'}) expires on ${expiryFormatted}.`,
      is_read: false,
      metadata: { refId: warranty.id, daysAway, productName: name, warrantyEndDate: warranty.warranty_end_date },
    });

    if (notifError) {
      logger.error({ err: notifError, warrantyId: warranty.id }, '[reminders] warranty notification insert failed');
    }

    if (settings?.email_notifications === false) continue;

    const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', warranty.user_id).single();
    if (!profile?.email) continue;

    const sent = await sendEmail({
      to: profile.email,
      from: EMAIL_SENDERS.reminders,
      subject: `Warranty alert: ${name} expires in ${daysAway} day${daysAway === 1 ? '' : 's'}`,
      html: reminderEmailHtml({
        firstName: profile.full_name?.split(' ')[0] ?? 'there',
        companyName: name, amount: 0,
        currency: 'USD', renewalDate: expiryFormatted,
        appUrl, daysAway, type: 'warranty',
      }),
      text: `Hi ${profile.full_name?.split(' ')[0] ?? 'there'},\n\nThe warranty for ${name} expires on ${expiryFormatted}.\n\nView at ${appUrl}/warranties`,
    });

    if (sent) {
      void supabaseAdmin.from('activity_logs').insert({
        user_id: warranty.user_id, type: 'reminder_sent',
        description: `Warranty reminder for ${name} sent (${daysAway}d window)`,
      }).then(undefined, () => {});
    } else {
      logger.warn({ userId: warranty.user_id, productName: name }, '[reminders] Email delivery failed for warranty reminder');
    }
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
      .eq('cancel_at_period_end', true) // Only auto-downgrade explicitly cancelled subs
      .lte('current_period_end', now);

    if (error) { logger.error({ error }, '[reminders] Expiry check failed'); return; }

    // Also check for subs that are active but have been expired for more than 3 days
    // (covers cases where a recurring payment failed but no webhook was received)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleExpired } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id, user_id')
      .eq('status', 'active')
      .eq('cancel_at_period_end', false)
      .lte('current_period_end', threeDaysAgo);

    const allExpired = [...(expired ?? []), ...(staleExpired ?? [])];
    if (!allExpired.length) return;

    logger.info({ count: allExpired.length }, '[reminders] Downgrading expired subscriptions');
    for (const sub of allExpired) {
      await supabaseAdmin.from('user_subscriptions').update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      await supabaseAdmin.from('profiles').update({ plan_id: 'free' }).eq('id', sub.user_id);

      await supabaseAdmin.from('activity_logs').insert({
        user_id: sub.user_id, type: 'plan_downgraded',
        description: 'Subscription expired — downgraded to Free plan automatically.',
      });
      // Also write a 'expiry_downgrade' entry so the diagnostics scheduler
      // check can confirm the downgrade job ran.
      void supabaseAdmin.from('activity_logs').insert({
        user_id: sub.user_id, type: 'expiry_downgrade',
        description: `Auto-downgrade to Free (sub ${sub.id})`,
      }).then(undefined, () => {});

      // In-app notification for the downgrade
      void supabaseAdmin.from('notifications').insert({
        user_id: sub.user_id, type: 'plan_downgraded',
        title: 'Your Pro plan has expired',
        body: 'Your ReceiptGuard Pro subscription has ended. Your data is safe. Upgrade to Pro to restore unlimited access.',
        is_read: false,
        metadata: { subscriptionId: sub.id },
      }).then(undefined, () => {});

      logger.info({ userId: sub.user_id }, '[reminders] Downgraded to free on expiry');
    }
  } catch (err) {
    logger.error({ err }, '[reminders] Expiry downgrade error');
  }
}

// ─── Main check ───────────────────────────────────────────────────────────────
// Note: automatic Gmail rescanning is handled exclusively by
// lib/gmail-scheduler.ts (Pro-only, 6h cadence, with proper retry/disconnect
// handling). It used to also run from a second loop here; that duplicate has
// been removed to avoid double-scanning every connected account.

async function runAllReminders(): Promise<void> {
  const appUrl = process.env.FRONTEND_URL ?? 'https://receiptguard.app';
  try {
    await Promise.all([
      ...RENEWAL_REMINDER_WINDOWS.map(w => runRenewalRemindersForWindow(w.days, appUrl)),
      ...WARRANTY_REMINDER_WINDOWS.map(w => runWarrantyRemindersForWindow(w.days, appUrl)),
    ]);
    logger.debug('[reminders] Reminder check complete');
  } catch (err) {
    logger.error({ err }, '[reminders] Scheduler error');
  }
}

// ─── Scheduler entry ──────────────────────────────────────────────────────────

let runCount = 0;

export function startReminderScheduler(): void {
  logger.info('[reminders] Scheduler started — checking every hour');

  const tick = async () => {
    runCount++;
    await runAllReminders();
    await runExpiryDowngrade();
    if (runCount % 24 === 1) await runSummaryEmails();
  };

  tick();
  setInterval(tick, INTERVAL_MS);
}
