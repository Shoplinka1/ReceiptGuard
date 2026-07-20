/**
 * Email helper using the Resend HTTP API.
 *
 * Configure via env vars:
 *   RESEND_API_KEY — Resend API key (required to actually send)
 *   EMAIL_FROM     — verified "From" address, e.g. "ReceiptGuard <noreply@yourdomain.com>".
 *                    Falls back to Resend's shared test sender (onboarding@resend.dev),
 *                    which can only deliver to the Resend account owner's own email —
 *                    fine for smoke-testing, not for real users. Verify a domain in the
 *                    Resend dashboard and set EMAIL_FROM to an address on it for production.
 *
 * If RESEND_API_KEY is not set, emails are logged to stdout (dev mode) instead of sent.
 * All Resend API errors are logged with full detail — never silently swallowed.
 *
 * Migrated off Gmail SMTP on 2026-07-10: Railway blocks outbound SMTP ports
 * (587/465/25) at the network level — transporter.verify()/sendMail() both
 * failed with ETIMEDOUT there regardless of host/DNS/auth config, even
 * though the same SMTP creds worked fine from Replit's network. Sending
 * over HTTPS via Resend's API sidesteps the blocked ports entirely.
 */
import { logger } from './logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'ReceiptGuard <onboarding@resend.dev>';

function logEmailConfigDiagnostics(context: string) {
  logger.warn({
    context,
    resendApiKeySet: !!RESEND_API_KEY,
    resendApiKeyLooksValid: !!RESEND_API_KEY && RESEND_API_KEY.startsWith('re_'),
    emailFrom: EMAIL_FROM,
    usingFallbackSender: EMAIL_FROM.includes('onboarding@resend.dev'),
  }, `[email][DEBUG] Resend config diagnostic (${context})`);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    logger.info(
      { to: opts.to, subject: opts.subject },
      '[email] RESEND_API_KEY not configured — email not sent',
    );
    logEmailConfigDiagnostics('sendEmail — not configured');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.error({
        to: opts.to,
        subject: opts.subject,
        status: res.status,
        statusText: res.statusText,
        body,
      }, '[email] Resend API request FAILED — email not delivered');
      logEmailConfigDiagnostics('send failed');
      return false;
    }

    logger.info({
      to: opts.to,
      subject: opts.subject,
      id: body?.id,
    }, '[email] sent successfully via Resend');
    return true;
  } catch (err: any) {
    logger.error({
      to: opts.to,
      subject: opts.subject,
      message: err?.message,
      code: err?.code,
      stack: err?.stack?.split('\n').slice(0, 3).join(' | '),
    }, '[email] Resend API call threw — email not delivered');
    logEmailConfigDiagnostics('send threw');
    return false;
  }
}
