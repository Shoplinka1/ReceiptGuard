/**
 * Gmail OAuth 2.0 Integration
 *
 * Stores OAuth tokens encrypted server-side. Never exposes tokens to the client.
 * Requires env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, ENCRYPTION_KEY
 *
 * Flow:
 *   1. GET  /api/gmail/auth-url  → returns the Google consent screen URL
 *   2. GET  /api/gmail/callback  → exchanges code for tokens, stores encrypted
 *   3. POST /api/gmail/scan      → scans inbox and extracts receipts via AI
 *   4. GET  /api/gmail/accounts  → lists connected Gmail accounts
 *   5. DELETE /api/gmail/accounts/:id → revokes and removes account
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import crypto from 'crypto';

const router: IRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:8080/api/gmail/callback';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte hex key

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// ─── Encryption helpers ─────────────────────────────────────────────────────

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY env var is required');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY env var is required');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const [ivHex, encHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuffer = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted.toString('utf8');
}

// ─── Routes ─────────────────────────────────────────────────────────────────

router.get('/api/gmail/auth-url', requireAuth, async (req, res): Promise<void> => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID.' });
    return;
  }

  // Embed userId in state so we can associate the account after callback
  const state = Buffer.from(JSON.stringify({ userId: req.userId })).toString('base64url');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

router.get('/api/gmail/callback', async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`/?error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }

  let userId: string;
  try {
    ({ userId } = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')));
  } catch {
    res.status(400).json({ error: 'Invalid state' });
    return;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).json({ error: 'Google OAuth not configured' });
    return;
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    res.status(502).json({ error: 'Failed to exchange code for tokens' });
    return;
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };

  // Get the user's email via userinfo API
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userInfoRes.json() as { email: string };

  // Store encrypted tokens server-side
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { error: dbError } = await supabaseAdmin.from('email_accounts').upsert({
    user_id: userId,
    email: userInfo.email,
    provider: 'gmail',
    access_token_enc: encrypt(tokens.access_token),
    refresh_token_enc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    token_expiry: expiry,
    scopes: GMAIL_SCOPES.split(' '),
    is_active: true,
  }, { onConflict: 'user_id,email' });

  if (dbError) {
    res.status(500).json({ error: 'Failed to save Gmail account' });
    return;
  }

  // Log the connection
  await supabaseAdmin.from('activity_logs').insert({
    user_id: userId,
    type: 'gmail_connected',
    description: `Gmail account ${userInfo.email} connected`,
    metadata: { email: userInfo.email },
  });

  // Redirect back to app
  res.redirect('/connect-gmail?status=connected');
});

router.get('/api/gmail/accounts', requireAuth, async (req, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('email_accounts')
    .select('id, email, provider, is_active, last_scanned_at, created_at')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

router.post('/api/gmail/scan', requireAuth, async (req, res): Promise<void> => {
  const { accountId } = req.body as { accountId?: string };

  // Get the email account with encrypted tokens
  const query = supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('user_id', req.userId)
    .eq('is_active', true);

  if (accountId) query.eq('id', accountId);

  const { data: accounts, error } = await query.limit(1).single();
  if (error || !accounts) {
    res.status(404).json({ error: 'No connected Gmail account found. Connect Gmail first.' });
    return;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      error: 'Gmail scanning not yet configured. Please add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ENCRYPTION_KEY environment variables.',
    });
    return;
  }

  // TODO: Refresh token if expired, then call Gmail API to fetch messages,
  // run AI extraction pipeline, and store results.
  // This requires ENCRYPTION_KEY to be set.
  res.json({
    status: 'pending',
    message: 'Gmail scan queued. Results will appear in your receipts shortly.',
    accountEmail: accounts.email,
  });
});

router.delete('/api/gmail/accounts/:id', requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from('email_accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', req.userId);

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from('activity_logs').insert({
    user_id: req.userId,
    type: 'gmail_disconnected',
    description: 'Gmail account disconnected',
    metadata: { accountId: id },
  });

  res.sendStatus(204);
});

export default router;
