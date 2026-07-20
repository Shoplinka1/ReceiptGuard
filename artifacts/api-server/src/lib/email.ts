/**
 * Email helper. Two transports, tried in this order:
 *
 *   1. Resend (preferred) — configure via RESEND_API_KEY.
 *      Uses the getreceiptguard.xyz domain senders (noreply@, reminders@,
 *      support@, feedback@). Requires that domain's SPF/DKIM/DMARC records
 *      to be verified in the Resend dashboard, otherwise Resend will reject
 *      or quarantine mail from an unverified domain.
 *   2. Nodemailer/SMTP (legacy fallback) — configure via EMAIL_HOST,
 *      EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM. Kept so existing
 *      Railway deployments that only have SMTP configured keep working.
 *
 * If neither is configured, emails are logged to stdout (dev mode).
 * All errors are logged with full detail — never silently swallowed.
 */
import { logger } from './logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN ?? 'getreceiptguard.xyz';

// Default senders on the verified domain. Callers can override `from` per-call
// (e.g. reminder-scheduler uses reminders@, feedback uses feedback@).
export const EMAIL_SENDERS = {
  noreply: `ReceiptGuard <noreply@${EMAIL_DOMAIN}>`,
  support: `ReceiptGuard Support <support@${EMAIL_DOMAIN}>`,
  reminders: `ReceiptGuard <reminders@${EMAIL_DOMAIN}>`,
  feedback: `ReceiptGuard <feedback@${EMAIL_DOMAIN}>`,
} as const;

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT ?? '587', 10);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM ?? EMAIL_USER ?? EMAIL_SENDERS.noreply;

// ─── Resend transport ──────────────────────────────────────────────────────────

async function sendViaResend(opts: { to: string; subject: string; html: string; text?: string; from?: string }): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.from ?? EMAIL_SENDERS.noreply,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({} as any));
      logger.error({
        to: opts.to,
        subject: opts.subject,
        status: res.status,
        errBody,
      }, '[email][resend] send FAILED');
      // Domain not verified yet (pending DNS) shows up as a 403 with a
      // "domain is not verified" message — surface that distinctly so it's
      // not confused with a real auth failure.
      if (res.status === 403) {
        logger.warn({ to: opts.to }, '[email][resend] likely cause: sending domain SPF/DKIM not verified yet in Resend dashboard (DNS propagation pending)');
      }
      return false;
    }

    const info = await res.json().catch(() => ({})) as { id?: string };
    logger.info({ to: opts.to, subject: opts.subject, id: info?.id }, '[email][resend] sent successfully');
    return true;
  } catch (err: any) {
    logger.error({ to: opts.to, subject: opts.subject, message: err?.message }, '[email][resend] request threw');
    return false;
  }
}

// Validate Gmail App Password format: exactly 16 non-whitespace chars
// (Google strips spaces in the UI but the actual password has no spaces)
function validateGmailAppPassword(pass: string | undefined): { valid: boolean; hint: string } {
  if (!pass) return { valid: false, hint: 'EMAIL_PASS is not set' };
  const stripped = pass.replace(/\s/g, '');
  if (stripped.length !== 16) {
    return {
      valid: false,
      hint: `EMAIL_PASS length after stripping spaces is ${stripped.length} (expected 16 for Gmail App Password)`,
    };
  }
  if (/\s/.test(pass)) {
    return {
      valid: true,
      hint: 'EMAIL_PASS contains spaces — they will be stripped for SMTP auth. Consider removing them from the env var.',
    };
  }
  return { valid: true, hint: 'looks valid (16 chars, no spaces)' };
}

function logEmailConfigDiagnostics(context: string) {
  const { valid: passValid, hint: passHint } = validateGmailAppPassword(EMAIL_PASS);
  logger.warn({
    context,
    emailHostSet: !!EMAIL_HOST,
    emailHost: EMAIL_HOST ?? '(not set)',
    emailPort: EMAIL_PORT,
    emailUserSet: !!EMAIL_USER,
    emailUserLooksLikeGmail: !!EMAIL_USER && /@gmail\.com$/i.test(EMAIL_USER),
    emailPassSet: !!EMAIL_PASS,
    emailPassHint: passHint,
    emailPassValid: passValid,
    emailFrom: EMAIL_FROM,
  }, `[email][DEBUG] SMTP config diagnostic (${context})`);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<boolean> {
  if (RESEND_API_KEY) {
    return sendViaResend(opts);
  }
  // No transport configured
  logger.info(
    { to: opts.to, subject: opts.subject },
    '[email] RESEND_API_KEY not set — email not sent. Set RESEND_API_KEY to enable delivery.',
  );
  return false;
}
