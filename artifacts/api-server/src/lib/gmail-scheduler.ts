import { supabaseAdmin } from './supabase';
import { logger } from './logger';
import { runGmailScan } from '../routes/gmail';

// How often to re-scan each connected Gmail account for new receipts.
const RESCAN_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

async function rescanAllAccounts(): Promise<void> {
  try {
    const { data: accounts, error } = await supabaseAdmin
      .from('email_accounts')
      .select('*')
      .eq('is_active', true);

    if (error) {
      logger.error({ error }, '[gmail-scheduler] Failed to fetch active email accounts');
      return;
    }
    if (!accounts || accounts.length === 0) {
      logger.debug('[gmail-scheduler] No active Gmail accounts to rescan');
      return;
    }

    logger.info({ count: accounts.length }, '[gmail-scheduler] Starting background rescan');

    for (const account of accounts) {
      try {
        // forceRescan=false: only pull messages newer than the last scan,
        // same incremental behavior as the manual "Scan now" button.
        await runGmailScan(account, account.user_id, false, false);
      } catch (err) {
        logger.error({ err, accountId: account.id }, '[gmail-scheduler] Rescan failed for account');
      }
    }
  } catch (err) {
    logger.error({ err }, '[gmail-scheduler] Rescan cycle error');
  }
}

export function startGmailRescanScheduler(): void {
  logger.info({ intervalHours: RESCAN_INTERVAL_MS / 3600000 }, '[gmail-scheduler] Background Gmail rescan scheduler started');
  // Skip an immediate run on boot (each account already gets scanned right
  // after it's connected) — first automatic rescan happens one interval in.
  setInterval(rescanAllAccounts, RESCAN_INTERVAL_MS);
}
