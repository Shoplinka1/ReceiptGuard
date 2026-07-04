/**
 * Renewal Reminder Scheduler
 *
 * Runs every hour and checks for subscriptions renewing in exactly 3 days.
 * For each match it:
 *   1. Creates a notification record in the DB (always)
 *   2. Sends a reminder email (if SMTP is configured via EMAIL_* env vars)
 *
 * Deduplicates: will not create a duplicate notification for the same
 * subscription renewal within the same day.
 */
import { supabaseAdmin } from './supabase';
import { sendEmail } from './email';
import { logger } from './logger';

const REMINDER_DAYS_BEFORE = 3;
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function reminderEmailHtml(opts: {
  firstName: string;
  companyName: string;
  amount: number;
  currency: string;
  renewalDate: string;
  appUrl: string;
}): string {
  const { firstName, companyName, amount, currency, renewalDate, appUrl } = opts;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Renewal Reminder</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <tr>
      <td style="background:#10b981;padding:28px 32px;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">ReceiptGuard</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Subscription renewing in 3 days</h2>
        <p style="margin:0 0 24px;color:#6b7280;">Hi ${firstName}, just a heads-up:</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;">${companyName}</p>
              <p style="margin:0;color:#6b7280;font-size:15px;">Renews on <strong>${renewalDate}</strong> for <strong>${currency} ${amount.toFixed(2)}</strong></p>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 24px;color:#374151;font-size:15px;">
          If you'd like to cancel or review this subscription before it renews, head to your ReceiptGuard dashboard.
        </p>

        <a href="${appUrl}/subscriptions" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
          View Subscriptions
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">
          You're receiving this because you have a ReceiptGuard account. 
          <a href="${appUrl}/settings" style="color:#10b981;">Manage notifications</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function runReminderCheck(): Promise<void> {
  try {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + REMINDER_DAYS_BEFORE);

    // Date window: any renewal on the target date (full calendar day)
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Find subscriptions renewing in 3 days that are still active
    const { data: renewals, error } = await supabaseAdmin
      .from('renewals')
      .select(`
        id,
        user_id,
        company_name,
        amount,
        currency,
        renewal_date,
        subscription_id
      `)
      .eq('status', 'upcoming')
      .gte('renewal_date', dayStart.toISOString())
      .lte('renewal_date', dayEnd.toISOString());

    if (error) {
      logger.error({ error }, '[reminders] Failed to fetch renewals');
      return;
    }

    if (!renewals || renewals.length === 0) {
      logger.debug('[reminders] No renewals due in 3 days');
      return;
    }

    logger.info({ count: renewals.length }, '[reminders] Processing renewal reminders');

    const appUrl = process.env.FRONTEND_URL ?? 'https://receiptguard.app';

    for (const renewal of renewals) {
      // Dedup: skip if we already sent a reminder for this renewal today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: existingNotif } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('user_id', renewal.user_id)
        .eq('type', 'renewal_reminder')
        .contains('metadata', { renewalId: renewal.id })
        .gte('created_at', todayStart.toISOString())
        .maybeSingle();

      if (existingNotif) {
        logger.debug({ renewalId: renewal.id }, '[reminders] Duplicate — already notified today');
        continue;
      }

      const renewalDateFormatted = new Date(renewal.renewal_date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

      // Create notification in DB
      await supabaseAdmin.from('notifications').insert({
        user_id: renewal.user_id,
        type: 'renewal_reminder',
        title: `${renewal.company_name} renews in 3 days`,
        message: `Your ${renewal.company_name} subscription (${renewal.currency ?? 'USD'} ${Number(renewal.amount).toFixed(2)}) renews on ${renewalDateFormatted}.`,
        read: false,
        metadata: {
          renewalId: renewal.id,
          subscriptionId: renewal.subscription_id,
          companyName: renewal.company_name,
          amount: renewal.amount,
          renewalDate: renewal.renewal_date,
        },
      });

      // Fetch user profile for name + email
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', renewal.user_id)
        .single();

      if (!profile?.email) continue;

      const firstName = profile.full_name?.split(' ')[0] ?? 'there';

      // Send reminder email
      await sendEmail({
        to: profile.email,
        subject: `Reminder: ${renewal.company_name} renews in 3 days`,
        html: reminderEmailHtml({
          firstName,
          companyName: renewal.company_name,
          amount: Number(renewal.amount),
          currency: renewal.currency ?? 'USD',
          renewalDate: renewalDateFormatted,
          appUrl,
        }),
        text: `Hi ${firstName},\n\nThis is a reminder that your ${renewal.company_name} subscription (${renewal.currency ?? 'USD'} ${Number(renewal.amount).toFixed(2)}) renews on ${renewalDateFormatted}.\n\nManage your subscriptions at ${appUrl}/subscriptions`,
      });
    }
  } catch (err) {
    logger.error({ err }, '[reminders] Scheduler error');
  }
}

async function runExpiryDowngrade(): Promise<void> {
  try {
    const now = new Date().toISOString();
    // Find active user_subscriptions that have passed their period end
    const { data: expired, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id, user_id')
      .eq('status', 'active')
      .lte('current_period_end', now);

    if (error) { logger.error({ error }, '[reminders] Expiry check failed'); return; }
    if (!expired || expired.length === 0) return;

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

export function startReminderScheduler(): void {
  logger.info('[reminders] Reminder scheduler started — checking every hour');

  // Run immediately on startup, then every hour
  runReminderCheck();
  runExpiryDowngrade();
  setInterval(() => { runReminderCheck(); runExpiryDowngrade(); }, INTERVAL_MS);
}
