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
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN ?? '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
  ?? (REPLIT_DEV_DOMAIN ? `https://${REPLIT_DEV_DOMAIN}/api/gmail/callback` : 'http://localhost:5173/api/gmail/callback');
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

// ─── Token refresh helper ────────────────────────────────────────────────────

async function getValidAccessToken(account: any): Promise<string> {
  const expiry = account.token_expiry ? new Date(account.token_expiry) : new Date(0);
  if (expiry > new Date(Date.now() + 5 * 60 * 1000) && account.access_token_enc) {
    return decrypt(account.access_token_enc);
  }
  if (!account.refresh_token_enc) throw new Error('No refresh token. User must reconnect Gmail.');
  const refreshToken = decrypt(account.refresh_token_enc);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!, client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Gmail token. User must reconnect Gmail.');
  const tokens = await res.json() as { access_token: string; expires_in: number };
  await supabaseAdmin.from('email_accounts').update({
    access_token_enc: encrypt(tokens.access_token),
    token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', account.id);
  return tokens.access_token;
}

// ─── Gmail REST API helper ───────────────────────────────────────────────────

async function gmailFetch(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(`Gmail API: ${err.error?.message ?? res.status}`);
  }
  return res.json();
}

// ─── Paginated message ID fetcher ────────────────────────────────────────────

const FREE_SCAN_LIMIT = 500;   // total message IDs across all queries
const PRO_SCAN_LIMIT  = 10_000; // safety ceiling for pro users

/**
 * Fetches all message IDs matching a Gmail search query, following nextPageToken
 * until exhausted or the per-query cap is reached.
 *
 * @param query       Gmail search query string
 * @param accessToken Valid OAuth access token
 * @param cap         Max IDs to collect for this query (use Infinity for uncapped,
 *                    but PRO_SCAN_LIMIT is enforced at the call-site)
 */
async function fetchAllMessageIds(
  query: string,
  accessToken: string,
  cap: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ q: query, maxResults: '500' });
    if (pageToken) params.set('pageToken', pageToken);

    const r = await gmailFetch(`/messages?${params.toString()}`, accessToken);
    const batch = (r.messages ?? []).map((m: any) => m.id as string);
    ids.push(...batch);

    pageToken = r.nextPageToken as string | undefined;

    if (ids.length >= cap) break;

    // Brief pause between pages — avoids hammering Gmail's quota
    if (pageToken) await new Promise(resolve => setTimeout(resolve, 150));
  } while (pageToken);

  return ids.slice(0, cap);
}

// ─── Receipt parser ──────────────────────────────────────────────────────────

const MERCHANT_DOMAINS: Record<string, string> = {
  'amazon.com': 'Amazon', 'amazon.co.uk': 'Amazon UK',
  'apple.com': 'Apple', 'itunes.com': 'Apple',
  'google.com': 'Google', 'googleplay.com': 'Google Play',
  'netflix.com': 'Netflix', 'spotify.com': 'Spotify', 'hulu.com': 'Hulu',
  'paypal.com': 'PayPal', 'stripe.com': 'Stripe',
  'uber.com': 'Uber', 'lyft.com': 'Lyft', 'doordash.com': 'DoorDash',
  'airbnb.com': 'Airbnb', 'booking.com': 'Booking.com', 'expedia.com': 'Expedia',
  'shopify.com': 'Shopify', 'etsy.com': 'Etsy', 'ebay.com': 'eBay',
  'walmart.com': 'Walmart', 'target.com': 'Target', 'bestbuy.com': 'Best Buy',
  'microsoft.com': 'Microsoft', 'xbox.com': 'Xbox',
  'steam.com': 'Steam', 'epicgames.com': 'Epic Games', 'playstation.com': 'PlayStation',
  'digitalocean.com': 'DigitalOcean', 'dropbox.com': 'Dropbox',
  'notion.so': 'Notion', 'slack.com': 'Slack', 'zoom.us': 'Zoom', 'figma.com': 'Figma',
  'github.com': 'GitHub', 'gitlab.com': 'GitLab',
  'adobe.com': 'Adobe', 'canva.com': 'Canva',
  'squarespace.com': 'Squarespace', 'godaddy.com': 'GoDaddy', 'namecheap.com': 'Namecheap',
  'cloudflare.com': 'Cloudflare',
};
const RECEIPT_SUBJECT_PATTERNS = [
  /receipt/i, /order\s*(confirmation|confirmed)/i, /invoice/i,
  /payment\s*(confirmation|received|successful)/i, /your\s*purchase/i,
  /shipping\s*confirmation/i, /your\s*order/i,
  /subscription\s*(confirmed|renewed|activated)/i, /trial\s*(started|activated|ending)/i,
  /warranty/i, /bill\s*(statement|due|paid)/i, /charge\s*from/i,
  /thank.*for.*order/i, /thank.*for.*purchase/i, /transaction\s*confirmed/i,
];
const SKIP_PATTERNS = [/unsubscribe/i, /newsletter/i, /weekly\s*digest/i, /daily\s*digest/i];

function extractEmailDomain(from: string): string {
  const m = from.match(/@([^>@\s]+)/);
  if (!m) return '';
  return m[1].toLowerCase().replace(/^(mail|email|mg|noreply|no-reply)\./i, '');
}
function getMerchantName(domain: string): string {
  if (MERCHANT_DOMAINS[domain]) return MERCHANT_DOMAINS[domain];
  for (const [k, v] of Object.entries(MERCHANT_DOMAINS)) {
    if (domain.endsWith(`.${k}`) || domain === k) return v;
  }
  const parts = domain.split('.');
  const main = parts.length >= 2 ? parts[parts.length - 2] : domain;
  return main.charAt(0).toUpperCase() + main.slice(1);
}
function extractAmount(text: string): { amount: number | null; currency: string } {
  const pats = [
    /(?:total|amount|charged|paid|price|subtotal)[^\d$£€₦]*[$£€₦]?\s*([\d,]+\.?\d{0,2})/i,
    /[$£€₦]\s*([\d,]+\.?\d{0,2})/,
    /([\d,]+\.?\d{2})\s*(?:USD|GBP|EUR|NGN|CAD|AUD)/i,
  ];
  const syms: Record<string, string> = { '$': 'USD', '£': 'GBP', '€': 'EUR', '₦': 'NGN' };
  for (const pat of pats) {
    const m = text.match(pat);
    if (m) {
      const amount = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0 && amount < 100000) {
        const sm = text.match(/[$£€₦]|(USD|GBP|EUR|NGN|CAD|AUD)/i);
        return { amount, currency: sm ? (syms[sm[0]] ?? sm[0].toUpperCase()) : 'USD' };
      }
    }
  }
  return { amount: null, currency: 'USD' };
}
function categorize(s: string, f: string, b: string): string {
  const t = `${s} ${f} ${b}`.toLowerCase();
  if (/netflix|spotify|hulu|disney|youtube.*premium|apple.*tv|prime.*video/.test(t)) return 'streaming';
  if (/subscription|saas|software|app|plan|pro|premium|license/.test(t)) return 'software';
  if (/amazon|shopify|etsy|ebay|walmart|target|bestbuy|shop|store/.test(t)) return 'shopping';
  if (/restaurant|food|doordash|grubhub|uber.*eat|coffee|dining/.test(t)) return 'food';
  if (/uber|lyft|transit|parking|airline|hotel|airbnb|booking|travel/.test(t)) return 'travel';
  if (/gym|fitness|health|medical|pharmacy|clinic/.test(t)) return 'health';
  if (/electricity|water|gas|internet|phone|mobile|utility/.test(t)) return 'utilities';
  if (/aws|digitalocean|hosting|domain|cloudflare|server/.test(t)) return 'infrastructure';
  return 'other';
}
function decodeB64(str: string): string {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}
function extractBodyText(parts: any[]): string {
  let text = '';
  for (const part of parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body?.data) text += decodeB64(part.body.data);
    else if (part.mimeType === 'text/html' && part.body?.data)
      text += decodeB64(part.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    else if (part.parts) text += extractBodyText(part.parts);
  }
  return text;
}
function parseMessage(msg: any): {
  merchantName: string; amount: number | null; currency: string; purchaseDate: string;
  category: string; invoiceNumber: string | null; orderId: string | null;
  paymentMethod: string | null; warrantyMonths: number | null; rawSubject: string; rawFrom: string;
} | null {
  const headers = msg.payload?.headers ?? [];
  const h = (n: string) => headers.find((x: any) => x.name.toLowerCase() === n)?.value ?? '';
  const subject = h('subject'), from = h('from'), date = h('date');
  if (!RECEIPT_SUBJECT_PATTERNS.some(p => p.test(subject))) return null;
  if (SKIP_PATTERNS.some(p => p.test(subject))) return null;
  let body = msg.payload?.body?.data
    ? decodeB64(msg.payload.body.data).replace(/<[^>]+>/g, ' ')
    : extractBodyText(msg.payload?.parts ?? []);
  const combined = `${subject}\n${body}`;
  const domain = extractEmailDomain(from);
  const { amount, currency } = extractAmount(combined);
  const invM = combined.match(/(?:invoice|order|receipt|confirmation|ref(?:erence)?)\s*(?:#|no\.?|num(?:ber)?)?\s*:?\s*([A-Z0-9\-_]{4,30})/i);
  const ordM = combined.match(/order\s*(?:id|#|no\.?)?\s*:?\s*([A-Z0-9\-_]{6,30})/i);
  const payM = combined.match(/(?:paid\s*(?:with|via)|payment\s*method)\s*:?\s*([\w\s]{3,30})/i);
  let purchaseDate = new Date().toISOString().split('T')[0];
  try { const d = new Date(date); if (!isNaN(d.getTime())) purchaseDate = d.toISOString().split('T')[0]; } catch { /* ok */ }
  const warYr = combined.match(/(\d+)\s*-?\s*year\s*(?:limited\s*)?warranty/i);
  const warMo = combined.match(/(\d+)\s*-?\s*month\s*(?:limited\s*)?warranty/i);
  const warrantyMonths = warYr ? parseInt(warYr[1]) * 12 : warMo ? parseInt(warMo[1]) : null;
  return {
    merchantName: getMerchantName(domain), amount, currency, purchaseDate,
    category: categorize(subject, from, body),
    invoiceNumber: invM?.[1] ?? null, orderId: ordM?.[1] ?? null,
    paymentMethod: payM?.[1]?.trim().slice(0, 50) ?? null,
    warrantyMonths, rawSubject: subject, rawFrom: from,
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

router.get('/api/gmail/auth-url', requireAuth, async (req, res): Promise<void> => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: 'Gmail not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your secrets.' });
    return;
  }

  // Free plan: max 1 Gmail account
  const { data: userPlan } = await supabaseAdmin.from('profiles').select('plan_id').eq('id', req.userId).single();
  if (userPlan?.plan_id !== 'pro') {
    const { count } = await supabaseAdmin.from('email_accounts').select('*', { count: 'exact', head: true }).eq('user_id', req.userId).eq('is_active', true);
    if ((count ?? 0) >= 1) {
      res.status(403).json({ error: 'Free plan allows 1 Gmail account. Upgrade to Pro for unlimited.', limitReached: true, limit: 1 });
      return;
    }
  }

  // Build a signed state parameter to prevent OAuth CSRF / account-linking attacks.
  // We sign the payload with SESSION_SECRET (or GOOGLE_CLIENT_SECRET as fallback)
  // so a forged state cannot be crafted without the server secret.
  const signingKey = process.env.SESSION_SECRET ?? GOOGLE_CLIENT_SECRET!;
  const nonce = crypto.randomBytes(16).toString('hex');
  const statePayload = JSON.stringify({ userId: req.userId, nonce });
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(statePayload)
    .digest('hex');
  const state = Buffer.from(JSON.stringify({ p: statePayload, s: signature })).toString('base64url');

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

  const frontendUrl = (REPLIT_DEV_DOMAIN ? `https://${REPLIT_DEV_DOMAIN}` : (process.env.FRONTEND_URL ?? 'http://localhost:5173')).replace(/\/+$/, '');

  if (error) {
    res.redirect(`${frontendUrl}/settings?tab=gmail&error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${frontendUrl}/settings?tab=gmail&error=missing_params`);
    return;
  }

  let userId: string;
  try {
    const { p: statePayload, s: signature } = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf8'),
    ) as { p: string; s: string };

    const signingKey = process.env.SESSION_SECRET ?? (GOOGLE_CLIENT_SECRET ?? '');
    const expectedSig = crypto.createHmac('sha256', signingKey).update(statePayload).digest('hex');

    if (!signature || expectedSig.length !== signature.length ||
      !crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(signature, 'hex'))) {
      res.redirect(`${frontendUrl}/settings?tab=gmail&error=invalid_state`);
      return;
    }

    ({ userId } = JSON.parse(statePayload) as { userId: string; nonce: string });
  } catch {
    res.redirect(`${frontendUrl}/settings?tab=gmail&error=bad_state`);
    return;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.redirect(`${frontendUrl}/settings?tab=gmail&error=not_configured`);
    return;
  }

  if (!ENCRYPTION_KEY) {
    res.redirect(`${frontendUrl}/settings?tab=gmail&error=encryption_not_configured`);
    return;
  }

  // Wrap everything from here in try/catch — any uncaught error must redirect
  // back to the frontend with an error param instead of surfacing as a JSON 500.
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.json().catch(() => ({})) as any;
      console.error('[Gmail] Token exchange failed:', JSON.stringify(errBody));
      res.redirect(`${frontendUrl}/settings?tab=gmail&error=token_exchange_failed`);
      return;
    }

    const tokens = await tokenRes.json() as {
      access_token: string; refresh_token?: string; expires_in: number;
    };

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoRes.ok) {
      res.redirect(`${frontendUrl}/settings?tab=gmail&error=userinfo_failed`);
      return;
    }
    const userInfo = await userInfoRes.json() as { email: string };

    const { data: newAccount, error: dbError } = await supabaseAdmin.from('email_accounts').upsert({
      user_id: userId, email: userInfo.email, provider: 'gmail',
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: GMAIL_SCOPES.split(' '), is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,email' }).select().single();

    if (dbError) {
      console.error('[Gmail] DB error:', dbError.message);
      res.redirect(`${frontendUrl}/settings?tab=gmail&error=db_error`);
      return;
    }

    try {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId, type: 'gmail_connected',
        description: `Gmail ${userInfo.email} connected`,
        metadata: { email: userInfo.email },
      });
    } catch (logErr: any) {
      console.error('[Gmail] activity_logs insert failed:', logErr?.message);
    }

    // Kick off background scan immediately after connection
    if (newAccount) {
      runGmailScan(newAccount, userId, false).catch(err =>
        console.error('[Gmail] Initial scan error:', err)
      );
    }

    res.redirect(`${frontendUrl}/settings?tab=gmail&connected=true`);
  } catch (err: any) {
    console.error('[Gmail] Callback unhandled error:', err?.message ?? err);
    res.redirect(`${frontendUrl}/settings?tab=gmail&error=server_error`);
  }
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
  const { accountId, forceRescan = false } = req.body as { accountId?: string; forceRescan?: boolean };

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).json({ error: 'Gmail not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your secrets.' });
    return;
  }
  if (!ENCRYPTION_KEY) {
    res.status(503).json({ error: 'Encryption not configured. Add ENCRYPTION_KEY to your secrets.' });
    return;
  }

  let query: any = supabaseAdmin
    .from('email_accounts').select('*').eq('user_id', req.userId).eq('is_active', true);
  if (accountId) query = query.eq('id', accountId);
  const { data: account, error: accErr } = await query.limit(1).single();

  if (accErr || !account) {
    res.status(404).json({ error: 'No connected Gmail account found. Connect Gmail first.' });
    return;
  }

  // Check plan so we can give the user an accurate message
  const { data: userPlan } = await supabaseAdmin.from('profiles').select('plan_id').eq('id', req.userId).single();
  const isPro = userPlan?.plan_id === 'pro';

  // Respond immediately — scan runs in background
  res.json({
    status: 'scanning',
    message: isPro
      ? `Deep inbox scan started. We'll scan up to ${PRO_SCAN_LIMIT.toLocaleString()} messages from your Gmail history — this may take a few minutes.`
      : `Inbox scan started (Free plan: up to ${FREE_SCAN_LIMIT} new messages). Upgrade to Pro to scan deeper into your Gmail history.`,
    accountEmail: account.email,
    isPro,
    scanLimit: isPro ? PRO_SCAN_LIMIT : FREE_SCAN_LIMIT,
  });

  // Background scan
  runGmailScan(account, req.userId, forceRescan).catch(err =>
    console.error('[Gmail Scan] Unhandled error:', err)
  );
});

export async function runGmailScan(account: any, userId: string, forceRescan: boolean): Promise<void> {
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(account);
  } catch (err: any) {
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId, type: 'gmail_scan_failed', description: err.message,
    });
    return;
  }

  // Determine plan-based scan cap
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('plan_id').eq('id', userId).single();
  const isPro = profile?.plan_id === 'pro';
  // totalCap = max NEW messages to process per scan run (applied after removing already-imported IDs)
  const totalCap = isPro ? PRO_SCAN_LIMIT : FREE_SCAN_LIMIT;
  // perQueryCap: over-fetch by 2× so that after removing already-imported IDs we still
  // have enough candidates to fill totalCap. Pro fetches up to the safety ceiling per query.
  const perQueryCap = isPro ? PRO_SCAN_LIMIT : FREE_SCAN_LIMIT * 2;

  console.log(`[Gmail Scan] ${account.email}: plan=${profile?.plan_id ?? 'free'}, totalCap=${totalCap}, perQueryCap=${perQueryCap}`);

  // Existing message IDs to avoid duplicates
  const { data: existing } = await supabaseAdmin
    .from('receipts').select('gmail_message_id').eq('user_id', userId).not('gmail_message_id', 'is', null);
  const alreadyImported = new Set((existing ?? []).map((r: any) => r.gmail_message_id));

  const gmailQueries = [
    'subject:(receipt OR "order confirmation" OR invoice OR "payment confirmation" OR "order confirmed") -in:spam -in:trash',
    'subject:("subscription confirmed" OR "subscription renewed" OR "trial started" OR warranty) -in:spam -in:trash',
    'subject:("shipping confirmation" OR "your shipment" OR "your package") -in:spam -in:trash',
  ];

  // Collect IDs from all queries with full pagination, then deduplicate across queries
  let allIds: string[] = [];
  for (const q of gmailQueries) {
    try {
      const ids = await fetchAllMessageIds(q, accessToken, perQueryCap);
      allIds.push(...ids);
    } catch (e: any) { console.warn('[Gmail Scan] Search error:', e.message); }
    // Pause between queries to stay within Gmail API rate limits
    await new Promise(r => setTimeout(r, 250));
  }

  // Deduplicate across queries first, THEN filter already-imported, THEN apply cap.
  // Ordering matters: applying the cap before filtering would mean repeated scans always
  // hit the same recently-fetched IDs and never advance into older inbox history.
  allIds = [...new Set(allIds)];
  if (!forceRescan) allIds = allIds.filter(id => !alreadyImported.has(id));
  allIds = allIds.slice(0, totalCap);

  console.log(`[Gmail Scan] ${account.email}: ${allIds.length} candidate messages to process`);

  let importedCount = 0, skippedCount = 0, failedCount = 0;

  // Log scan start
  await supabaseAdmin.from('activity_logs').insert({
    user_id: userId, type: 'gmail_scan_started',
    description: `Scanning ${allIds.length} messages (${isPro ? 'Pro — full history' : `Free — up to ${FREE_SCAN_LIMIT}`})`,
    metadata: { total: allIds.length, isPro, forceRescan },
  });

  for (let i = 0; i < allIds.length; i += 10) {
    await Promise.all(allIds.slice(i, i + 10).map(async (msgId) => {
      try {
        const msg = await gmailFetch(`/messages/${msgId}?format=full`, accessToken);
        const parsed = parseMessage(msg);
        if (!parsed || !parsed.amount) { skippedCount++; return; }

        const warrantyEnd = parsed.warrantyMonths
          ? (() => { const d = new Date(parsed.purchaseDate); d.setMonth(d.getMonth() + parsed.warrantyMonths!); return d.toISOString().split('T')[0]; })()
          : null;

        const { error: e } = await supabaseAdmin.from('receipts').upsert({
          user_id: userId, email_account_id: account.id, gmail_message_id: msgId,
          merchant_name: parsed.merchantName, amount: parsed.amount, currency: parsed.currency,
          purchase_date: parsed.purchaseDate, category: parsed.category, status: 'confirmed',
          invoice_number: parsed.invoiceNumber, order_id: parsed.orderId,
          payment_method: parsed.paymentMethod, warranty_months: parsed.warrantyMonths,
          warranty_end_date: warrantyEnd, raw_email_subject: parsed.rawSubject, raw_email_from: parsed.rawFrom,
        }, { onConflict: 'user_id,gmail_message_id', ignoreDuplicates: true });

        if (e) { failedCount++; return; }
        importedCount++;

        // Auto-detect subscription
        if (/subscription|recurring|monthly|annual|yearly|auto-renew/i.test(`${parsed.rawSubject}${parsed.rawFrom}`)) {
          await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId, name: parsed.merchantName, merchant_name: parsed.merchantName,
            monthly_price: parsed.amount, currency: parsed.currency,
            billing_cycle: /annual|yearly/i.test(parsed.rawSubject) ? 'yearly' : 'monthly',
            category: parsed.category, status: 'active',
          }, { onConflict: 'user_id,name', ignoreDuplicates: true });
        }

        // Auto-create warranty record
        if (parsed.warrantyMonths && warrantyEnd) {
          await supabaseAdmin.from('warranties').upsert({
            user_id: userId, product_name: parsed.merchantName, merchant_name: parsed.merchantName,
            purchase_date: parsed.purchaseDate, warranty_end_date: warrantyEnd,
            warranty_months: parsed.warrantyMonths,
            status: new Date(warrantyEnd) > new Date() ? 'active' : 'expired',
          }, { onConflict: 'user_id,product_name', ignoreDuplicates: true });
        }
      } catch (e: any) { console.warn('[Gmail Scan] Message error:', e.message); failedCount++; }
    }));

    // Log progress every 100 messages so admin can track long scans
    const processed = Math.min(i + 10, allIds.length);
    if (processed % 100 === 0 || processed === allIds.length) {
      console.log(`[Gmail Scan] ${account.email}: progress ${processed}/${allIds.length} — ${importedCount} imported, ${skippedCount} skipped`);
    }

    if (i + 10 < allIds.length) await new Promise(r => setTimeout(r, 200));
  }

  await supabaseAdmin.from('email_accounts')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', account.id);

  await supabaseAdmin.from('activity_logs').insert({
    user_id: userId, type: 'gmail_scan_complete',
    description: `Scan complete: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed (of ${allIds.length} candidates)`,
    metadata: { importedCount, skippedCount, failedCount, total: allIds.length, isPro, forceRescan },
  });

  console.log(`[Gmail Scan] ${account.email}: DONE — ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed`);
}

router.delete('/api/gmail/accounts/:id', requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;

  // Fetch account first so we can revoke the token with Google before deleting
  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('access_token_enc, refresh_token_enc, email')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single();

  // Revoke the Google token — best-effort, never block disconnect on failure
  if (account && ENCRYPTION_KEY) {
    try {
      const tokenToRevoke = account.refresh_token_enc
        ? decrypt(account.refresh_token_enc)
        : account.access_token_enc
          ? decrypt(account.access_token_enc)
          : null;

      if (tokenToRevoke) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).catch(e => console.warn('[Gmail] Token revocation request failed:', e.message));
      }
    } catch (e: any) {
      console.warn('[Gmail] Could not revoke token during disconnect:', e.message);
    }
  }

  const { error } = await supabaseAdmin
    .from('email_accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', req.userId);

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from('activity_logs').insert({
    user_id: req.userId,
    type: 'gmail_disconnected',
    description: `Gmail account disconnected${account?.email ? ` (${account.email})` : ''}`,
    metadata: { accountId: id },
  });

  res.sendStatus(204);
});

export default router;
