/**
 * Automatic Gmail scan scheduler (Pro only).
 *
 * This is the ONLY place that triggers background/unattended Gmail rescans.
 * (Previously there were two independent loops — this file's fixed 3-hour
 * sweep and a second one inside reminder-scheduler.ts on a ~daily cadence —
 * which double-scanned every connected account with no plan awareness. They
 * have been consolidated here.)
 *
 * Rules:
 *   - Free plan accounts are never auto-scanned — Free users must use the
 *     manual "Scan now" button. We only ever touch accounts whose owner is
 *     currently on the Pro plan with an active (non-expired) subscription.
 *   - Pro accounts are rescanned automatically every 6 hours.
 *   - Disconnected accounts (is_active = false) are skipped. An account that
 *     fails with an auth-type error (bad/revoked token) is automatically
 *     marked disconnected so it stops being retried forever — the user has
 *     to reconnect from Settings.
 *   - Transient failures (rate limit / Gmail outage) are retried sooner
 *     (15 min, up to 3 attempts) before falling back to the normal 6h cycle.
 *   - Every attempt persists last_scan / next_scan / scan_status /
 *     scan_duration_ms / scan_error / scan_retry_count on email_accounts so
 *     scan health is visible without reading logs (e.g. from the admin app).
 *
 * If the DB hasn't been migrated with the scan-tracking columns yet
 * (see supabase/migration.sql Phase 5), every column write below is wrapped
 * so a missing-column error degrades to a log line instead of crashing the
 * scheduler tick.
 */
import { supabaseAdmin } from './supabase';
import { logger } from './logger';
import { runGmailScan } from '../routes/gmail';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // tick every 15 minutes, only act on accounts that are due
const PRO_RESCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const RETRY_INTERVAL_MS = 15 * 60 * 1000; // retry transient failures after 15 minutes
const MAX_RETRIES = 3;

type ScanTrackingUpdate = {
  last_scan?: string;
  next_scan?: string | null;
  scan_status?: 'idle' | 'scanning' | 'success' | 'failed';
  scan_duration_ms?: number;
  scan_error?: string | null;
  scan_retry_count?: number;
  is_active?: boolean;
  last_scanned_at?: string;
};

// Tracks whether the scan-tracking columns exist, so we only log the warning
// once instead of once per account per tick.
let scanColumnsMissingWarned = false;

async function updateScanTracking(accountId: string, update: ScanTrackingUpdate): Promise<void> {
  const { error } = await supabaseAdmin.from('email_accounts').update(update).eq('id', accountId);
  if (error) {
    if (!scanColumnsMissingWarned) {
      logger.warn({ error, accountId }, '[gmail-scheduler] Could not persist scan tracking columns — has supabase/migration.sql Phase 5 been run against this Supabase project?');
      scanColumnsMissingWarned = true;
    }
  }
}

async function isEligibleForAutoScan(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin.from('profiles').select('plan_id').eq('id', userId).maybeSingle();
  if (profile?.plan_id !== 'pro') return false; // Free = manual scan only

  const { data: sub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (!sub) return false; // no active Pro subscription (expired/cancelled)
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return false; // expired but not yet downgraded

  return true;
}

async function scanOneAccount(account: any): Promise<void> {
  const startedAt = Date.now();
  await updateScanTracking(account.id, { scan_status: 'scanning', last_scan: new Date(startedAt).toISOString() });

  let result;
  try {
    result = await runGmailScan(account, account.user_id, false, false);
  } catch (err: any) {
    // runGmailScan is designed not to throw, but guard anyway — an uncaught
    // throw here must never kill the scheduler loop for the remaining accounts.
    logger.error({ err: err?.message, accountId: account.id }, '[gmail-scheduler] runGmailScan threw unexpectedly');
    result = { success: false, errorType: 'transient' as const, message: err?.message ?? 'unknown error' };
  }
  const durationMs = Date.now() - startedAt;

  if (result.success) {
    await updateScanTracking(account.id, {
      last_scan: new Date().toISOString(),
      next_scan: new Date(Date.now() + PRO_RESCAN_INTERVAL_MS).toISOString(),
      scan_status: 'success',
      scan_duration_ms: durationMs,
      scan_error: null,
      scan_retry_count: 0,
    });
    logger.info({ email: account.email, durationMs, importedCount: result.importedCount }, '[gmail-scheduler] scan succeeded');
    return;
  }

  if (result.errorType === 'auth') {
    // Dead connection — retrying will never succeed. Mark disconnected so
    // this account stops being picked up until the user reconnects Gmail.
    await updateScanTracking(account.id, {
      is_active: false,
      scan_status: 'failed',
      scan_duration_ms: durationMs,
      scan_error: result.message ?? 'Gmail authorization failed',
      next_scan: null,
    });
    logger.warn({ email: account.email, message: result.message }, '[gmail-scheduler] auth failure — account marked disconnected, user must reconnect Gmail');
    return;
  }

  // Transient failure — retry soon, up to MAX_RETRIES, then fall back to the
  // normal 6h cadence rather than retrying forever.
  const retryCount = (account.scan_retry_count ?? 0) + 1;
  const willRetrySoon = retryCount <= MAX_RETRIES;
  await updateScanTracking(account.id, {
    scan_status: 'failed',
    scan_duration_ms: durationMs,
    scan_error: result.message ?? 'Unknown transient error',
    scan_retry_count: willRetrySoon ? retryCount : 0,
    next_scan: new Date(Date.now() + (willRetrySoon ? RETRY_INTERVAL_MS : PRO_RESCAN_INTERVAL_MS)).toISOString(),
  });
  logger.warn({ email: account.email, retryCount, willRetrySoon, message: result.message }, '[gmail-scheduler] transient failure — will retry');
}

async function runSchedulerTick(): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const { data: accounts, error } = await supabaseAdmin
      .from('email_accounts')
      .select('*')
      .eq('is_active', true)
      .or(`next_scan.is.null,next_scan.lte.${nowIso}`);

    if (error) {
      // If next_scan doesn't exist yet (pre-migration), fall back to
      // scanning every active account on the old fixed cadence rather than
      // failing the whole tick — better to over-scan slightly than to stop
      // automatic scanning entirely until the migration is run.
      logger.warn({ error }, '[gmail-scheduler] next_scan column query failed — falling back to scanning all active accounts (has migration Phase 5 been run?)');
      const { data: fallbackAccounts } = await supabaseAdmin.from('email_accounts').select('*').eq('is_active', true);
      for (const account of fallbackAccounts ?? []) {
        if (await isEligibleForAutoScan(account.user_id)) await scanOneAccount(account);
      }
      return;
    }

    if (!accounts?.length) {
      logger.debug('[gmail-scheduler] No accounts due for automatic scan');
      return;
    }

    let scanned = 0, skippedFreePlan = 0;
    for (const account of accounts) {
      const eligible = await isEligibleForAutoScan(account.user_id);
      if (!eligible) {
        skippedFreePlan++;
        continue; // Free plan / no active Pro subscription — manual scan only
      }
      await scanOneAccount(account);
      scanned++;
    }

    logger.info({ scanned, skippedFreePlan, totalDue: accounts.length }, '[gmail-scheduler] tick complete');
  } catch (err) {
    logger.error({ err }, '[gmail-scheduler] tick error');
  }
}

export function startGmailRescanScheduler(): void {
  logger.info({ checkIntervalMinutes: CHECK_INTERVAL_MS / 60000, proRescanHours: PRO_RESCAN_INTERVAL_MS / 3600000 }, '[gmail-scheduler] Automatic Gmail scan scheduler started (Pro accounts only, Free = manual scan)');
  setInterval(runSchedulerTick, CHECK_INTERVAL_MS);
  // Run once shortly after boot (not immediately, to let the server settle)
  // so accounts with a null next_scan get scheduled without waiting a full
  // interval.
  setTimeout(runSchedulerTick, 30_000);
}
