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
import nodemailer from 'nodemailer';
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

let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) return null;
  // Reuse the transport across calls — avoids creating a new TCP connection for every email
  if (!_transport) {
    // Strip spaces from app password (common copy-paste issue from Google UI)
    const cleanPass = EMAIL_PASS.replace(/\s/g, '');
    _transport = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: { user: EMAIL_USER, pass: cleanPass },
      // Increase timeouts for slow SMTP servers
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }
  return _transport;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<boolean> {
  // Prefer Resend when configured — it's the production email path going
  // forward (see EMAIL_SENDERS). Falls through to SMTP/dev-log only if
  // RESEND_API_KEY isn't set, so existing Railway SMTP setups keep working
  // until they're migrated.
  if (RESEND_API_KEY) {
    return sendViaResend(opts);
  }

  const transport = getTransport();
  if (!transport) {
    logger.info(
      { to: opts.to, subject: opts.subject },
      '[email] Neither Resend nor SMTP configured — email not sent (set RESEND_API_KEY, or EMAIL_HOST/EMAIL_USER/EMAIL_PASS)',
    );
    logEmailConfigDiagnostics('sendEmail — not configured');
    return false;
  }

  // Verify SMTP connection before sending. Log the result either way.
  try {
    await transport.verify();
    logger.info('[email] transporter.verify() succeeded — SMTP connection is healthy');
  } catch (verifyErr: any) {
    logger.error({
      message: verifyErr?.message,
      code: verifyErr?.code,
      command: verifyErr?.command,
      responseCode: verifyErr?.responseCode,
      response: verifyErr?.response,
    }, '[email] transporter.verify() FAILED — SMTP connection broken');
    logEmailConfigDiagnostics('verify failed');
    // Reset transport so next call reconnects fresh
    _transport = null;
    // Still attempt sendMail — some providers respond differently to verify vs actual send
  }

  try {
    const info = await transport.sendMail({
      from: opts.from ?? EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    logger.info({
      to: opts.to,
      subject: opts.subject,
      messageId: info?.messageId,
      response: info?.response,
      accepted: info?.accepted,
      rejected: info?.rejected,
    }, '[email] sent successfully');
    return true;
  } catch (err: any) {
    logger.error({
      to: opts.to,
      subject: opts.subject,
      message: err?.message,
      code: err?.code,
      command: err?.command,
      responseCode: err?.responseCode,
      response: err?.response,
      stack: err?.stack?.split('\n').slice(0, 3).join(' | '),
    }, '[email] sendMail FAILED — email not delivered');
    logEmailConfigDiagnostics('sendMail failed');
    // Reset transport on auth/connection errors so next attempt gets a fresh connection
    if (err?.code === 'EAUTH' || err?.code === 'ECONNECTION' || err?.responseCode === 535) {
      _transport = null;
    }
    return false;
  }
}
