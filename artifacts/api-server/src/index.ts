import app from "./app";
import { logger } from "./lib/logger";
import { startReminderScheduler } from "./lib/reminder-scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Print the Supabase project reference so Railway logs can confirm which
  // database this backend is connected to.  Compare with VITE_SUPABASE_URL
  // on the frontend — they must share the same project reference.
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '(not set)';
  logger.info({ projectRef }, `[supabase] connected to project ref: ${projectRef}`);
  if (projectRef === '(not set)') {
    logger.warn('⚠️  SUPABASE_URL is not set on this server. All DB and auth calls will fail.');
  }

  // Warn loudly if critical env vars are missing — these cause runtime errors
  if (!process.env.ENCRYPTION_KEY) {
    logger.warn('⚠️  ENCRYPTION_KEY env var is missing. Gmail token encryption/decryption will fail. Set a 32-byte hex key on Railway.');
  } else if (Buffer.from(process.env.ENCRYPTION_KEY, 'hex').length !== 32) {
    logger.warn('⚠️  ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars). Gmail will fail until this is corrected.');
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('⚠️  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing. Gmail OAuth will not work.');
  }
  if (!process.env.PAYSTACK_SECRET_KEY) {
    logger.warn('⚠️  PAYSTACK_SECRET_KEY missing. Payments will not work.');
  }

  // Start background jobs
  startReminderScheduler();
});
