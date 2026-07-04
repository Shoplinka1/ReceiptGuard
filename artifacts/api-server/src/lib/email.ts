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

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, '[email] SMTP not configured — email not sent (set EMAIL_HOST, EMAIL_USER, EMAIL_PASS)');
    return false;
  }
  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    logger.info({ to: opts.to, subject: opts.subject }, '[email] sent');
    return true;
  } catch (err) {
    logger.error({ err, to: opts.to }, '[email] send failed');
    return false;
  }
}
