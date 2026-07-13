/**
 * Email helper using Nodemailer.
 * Configure via env vars:
 *   EMAIL_HOST     — SMTP host (e.g. smtp.gmail.com)
 *   EMAIL_PORT     — SMTP port (default 587)
 *   EMAIL_USER     — SMTP username / sender address
 *   EMAIL_PASS     — SMTP password or app password (Gmail: 16-char app password, no spaces)
 *   EMAIL_FROM     — "From" display (default: EMAIL_USER)
 *
 * If EMAIL_HOST/USER/PASS are not set, emails are logged to stdout (dev mode).
 * All SMTP errors are logged with full detail — never silently swallowed.
 */
import nodemailer from 'nodemailer';
import { logger } from './logger';

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT ?? '587', 10);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM ?? EMAIL_USER ?? 'noreply@receiptguard.app';

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
}): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    logger.info(
      { to: opts.to, subject: opts.subject },
      '[email] SMTP not configured — email not sent (set EMAIL_HOST, EMAIL_USER, EMAIL_PASS)',
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
      from: EMAIL_FROM,
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
