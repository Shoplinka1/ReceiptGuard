/**
 * Email helper using Nodemailer.
 * Configure via env vars:
 *   EMAIL_HOST     — SMTP host (e.g. smtp.gmail.com)
 *   EMAIL_PORT     — SMTP port (default 587)
 *   EMAIL_USER     — SMTP username / sender address
 *   EMAIL_PASS     — SMTP password or app password
 *   EMAIL_FROM     — "From" display (default: EMAIL_USER)
 *
 * If none are set the mailer logs the email to stdout instead of sending it.
 */
import nodemailer from 'nodemailer';
import { logger } from './logger';

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT ?? '587', 10);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM ?? EMAIL_USER ?? 'noreply@receiptguard.app';

function createTransport() {
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

// TEMPORARY DIAGNOSTIC — logs only metadata about the SMTP config (never the
// password) so we can see exactly why delivery is failing in production.
// Safe to remove once email delivery is confirmed working.
function logEmailConfigDiagnostics() {
  logger.warn({
    emailHostSet: !!EMAIL_HOST,
    emailPort: EMAIL_PORT,
    emailUserSet: !!EMAIL_USER,
    emailUserLooksLikeGmail: !!EMAIL_USER && /@gmail\.com$/i.test(EMAIL_USER),
    emailPassSet: !!EMAIL_PASS,
    emailPassLength: EMAIL_PASS?.length ?? 0,
    emailPassHasSpaces: !!EMAIL_PASS && /\s/.test(EMAIL_PASS),
    emailFrom: EMAIL_FROM,
  }, '[email][DEBUG] SMTP config diagnostic');
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, '[email] SMTP not configured — email not sent (set EMAIL_HOST, EMAIL_USER, EMAIL_PASS)');
    logEmailConfigDiagnostics();
    return false;
  }
  try {
    await transport.verify();
    logger.info('[email] transporter.verify() succeeded — SMTP auth is valid');
  } catch (verifyErr: any) {
    logger.error({
      message: verifyErr?.message,
      code: verifyErr?.code,
      command: verifyErr?.command,
      responseCode: verifyErr?.responseCode,
      response: verifyErr?.response,
    }, '[email] transporter.verify() FAILED — SMTP auth/connection is broken');
    logEmailConfigDiagnostics();
    // Continue to attempt sendMail anyway — verify() can be overly strict with
    // some providers, and we want the real sendMail error if verify was wrong.
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
    }, '[email] sent');
    return true;
  } catch (err: any) {
    logger.error({
      to: opts.to,
      message: err?.message,
      code: err?.code,
      command: err?.command,
      responseCode: err?.responseCode,
      response: err?.response,
    }, '[email] send failed');
    return false;
  }
}
