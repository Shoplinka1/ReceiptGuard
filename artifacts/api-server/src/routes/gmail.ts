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
import { logger } from '../lib/logger';

const router: IRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN ?? '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
  ?? (REPLIT_DEV_DOMAIN ? `https://${REPLIT_DEV_DOMAIN}/api/gmail/callback` : 'http://localhost:5173/api/gmail/callback');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const isValidEncryptionKey = (key: string | undefined): boolean =>
  !!key && /^[0-9a-fA-F]{64}$/.test(key);

function logEncryptionKeyDiagnostics(context: string) {
  const key = process.env.ENCRYPTION_KEY;
  logger.warn({
    context,
    exists: key !== undefined,
    isEmptyString: key === '',
    length: key?.length ?? 0,
    hasWhitespace: !!key && /\s/.test(key),
    matchesHexRegex: !!key && /^[0-9a-fA-F]{64}$/.test(key),
    firstCharIsHex: !!key && /^[0-9a-fA-F]/.test(key[0] ?? ''),
    nodeEnv: process.env.NODE_ENV ?? 'not set',
  }, '[Gmail][DEBUG] ENCRYPTION_KEY diagnostic');
}

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// ─── Plan limits ─────────────────────────────────────────────────────────────

// Free: initial scan of 150 messages — enough to discover receipts without
// giving away the full mailbox, which is the Pro upgrade incentive.
export const FREE_SCAN_LIMIT    = 150;
export const FREE_RECEIPT_LIMIT = 50;
export const FREE_WARRANTY_LIMIT = 5;

// Pro: full history scan up to 10,000 (safety ceiling)
const PRO_SCAN_LIMIT = 10_000;

// ─── Encryption helpers ───────────────────────────────────────────────────────

function encrypt(text: string): string {
  if (!isValidEncryptionKey(ENCRYPTION_KEY)) throw new Error('ENCRYPTION_KEY env var is missing or is not a valid 64-character hex string');
  const key = Buffer.from(ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encryptedText: string): string {
  if (!isValidEncryptionKey(ENCRYPTION_KEY)) throw new Error('ENCRYPTION_KEY env var is missing or is not a valid 64-character hex string');
  const key = Buffer.from(ENCRYPTION_KEY!, 'hex');
  const [ivHex, encHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuffer = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted.toString('utf8');
}

// ─── Token refresh helper ─────────────────────────────────────────────────────

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

// ─── Gmail REST API helper ────────────────────────────────────────────────────

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

// ─── Paginated message ID fetcher ─────────────────────────────────────────────

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

    if (pageToken) await new Promise(resolve => setTimeout(resolve, 150));
  } while (pageToken);

  return ids.slice(0, cap);
}

// ─── Receipt parser ───────────────────────────────────────────────────────────

const MERCHANT_DOMAINS: Record<string, string> = {
  'amazon.com': 'Amazon', 'amazon.co.uk': 'Amazon UK', 'amazon.ca': 'Amazon CA',
  'apple.com': 'Apple', 'itunes.com': 'Apple', 'apps.apple.com': 'Apple',
  'google.com': 'Google', 'googleplay.com': 'Google Play',
  'netflix.com': 'Netflix', 'spotify.com': 'Spotify', 'hulu.com': 'Hulu',
  'disneyplus.com': 'Disney+', 'hbomax.com': 'HBO Max', 'paramountplus.com': 'Paramount+',
  'paypal.com': 'PayPal', 'stripe.com': 'Stripe',
  'uber.com': 'Uber', 'lyft.com': 'Lyft', 'doordash.com': 'DoorDash',
  'grubhub.com': 'Grubhub', 'instacart.com': 'Instacart',
  'airbnb.com': 'Airbnb', 'booking.com': 'Booking.com', 'expedia.com': 'Expedia',
  'hotels.com': 'Hotels.com',
  'shopify.com': 'Shopify', 'etsy.com': 'Etsy', 'ebay.com': 'eBay',
  'walmart.com': 'Walmart', 'target.com': 'Target', 'bestbuy.com': 'Best Buy',
  'costco.com': 'Costco', 'homedepot.com': 'Home Depot', 'lowes.com': "Lowe's",
  'microsoft.com': 'Microsoft', 'xbox.com': 'Xbox', 'office.com': 'Microsoft Office',
  'steam.com': 'Steam', 'steampowered.com': 'Steam',
  'epicgames.com': 'Epic Games', 'playstation.com': 'PlayStation',
  'digitalocean.com': 'DigitalOcean', 'linode.com': 'Linode', 'vultr.com': 'Vultr',
  'dropbox.com': 'Dropbox', 'box.com': 'Box',
  'notion.so': 'Notion', 'slack.com': 'Slack', 'zoom.us': 'Zoom',
  'figma.com': 'Figma', 'sketch.com': 'Sketch',
  'github.com': 'GitHub', 'gitlab.com': 'GitLab',
  'adobe.com': 'Adobe', 'canva.com': 'Canva', 'shutterstock.com': 'Shutterstock',
  'squarespace.com': 'Squarespace', 'godaddy.com': 'GoDaddy', 'namecheap.com': 'Namecheap',
  'cloudflare.com': 'Cloudflare', 'fastly.com': 'Fastly',
  'sendgrid.com': 'SendGrid', 'mailchimp.com': 'Mailchimp',
  'twilio.com': 'Twilio', 'datadog.com': 'Datadog',
  'atlassian.com': 'Atlassian', 'jira.com': 'Jira', 'confluence.com': 'Confluence',
  'salesforce.com': 'Salesforce', 'hubspot.com': 'HubSpot',
  'openai.com': 'OpenAI', 'anthropic.com': 'Anthropic',
};

// Emails from crypto exchanges / wallets should be skipped entirely —
// they contain trading amounts, balances, and transaction IDs that are not
// purchases and would corrupt receipt statistics.
const CRYPTO_EXCHANGE_DOMAINS = new Set([
  'bybit.com', 'binance.com', 'coinbase.com', 'kraken.com', 'bitfinex.com',
  'kucoin.com', 'huobi.com', 'okx.com', 'gate.io', 'bitstamp.net',
  'crypto.com', 'gemini.com', 'bitmex.com', 'bittrex.com', 'poloniex.com',
  'ftx.com', 'deribit.com', 'blockchain.com', 'exodus.com', 'trustwallet.com',
]);

// Subject patterns that reliably indicate a purchase email
const RECEIPT_SUBJECT_PATTERNS = [
  /receipt/i, /order\s*(confirmation|confirmed)/i, /invoice/i,
  /payment\s*(confirmation|received|successful)/i, /your\s*purchase/i,
  /shipping\s*confirmation/i, /your\s*order/i,
  /subscription\s*(confirmed|renewed|activated)/i, /trial\s*(started|activated|ending)/i,
  /warranty/i, /bill\s*(statement|due|paid)/i, /charge\s*from/i,
  /thank.*for.*order/i, /thank.*for.*purchase/i, /transaction\s*confirmed/i,
];

// Subject patterns that reliably indicate non-receipt emails to skip
const SKIP_SUBJECT_PATTERNS = [
  /unsubscribe/i, /newsletter/i, /weekly\s*digest/i, /daily\s*digest/i,
  /promotional/i, /marketing/i, /sale\s*alert/i, /flash\s*sale/i,
  // Crypto-specific patterns
  /deposit\s*(confirmed|received)/i, /withdrawal\s*(confirmed|requested)/i,
  /trading\s*(alert|signal)/i, /price\s*alert/i, /market\s*update/i,
  /crypto.*transfer/i, /wallet\s*address/i, /blockchain.*confirmation/i,
  /fund.*account/i, /kyc\s*(approved|required)/i,
];

// Body patterns that indicate this is a crypto/trading email, not a receipt
const CRYPTO_BODY_PATTERNS = [
  /\b(BTC|ETH|USDT|BNB|XRP|SOL|ADA|DOGE|MATIC|DOT)\b/,
  /\bcrypto\s*(balance|wallet|portfolio)/i,
  /\btrading\s*(pair|volume|position)/i,
  /\b(spot|futures|perpetual)\s*(trade|order|contract)/i,
  /\bwithdrawal\s*address/i,
  /\btransaction\s*(hash|id)\s*:/i,
  /\bblock(?:chain)?\s*explorer/i,
];

function extractEmailDomain(from: string): string {
  const m = from.match(/@([^>@\s]+)/);
  if (!m) return '';
  return m[1].toLowerCase().replace(/^(mail|email|mg|noreply|no-reply|notifications?|info|support|billing|invoices?|receipts?)\./i, '');
}

function getMerchantName(domain: string, rawFrom: string): string {
  if (MERCHANT_DOMAINS[domain]) return MERCHANT_DOMAINS[domain];
  for (const [k, v] of Object.entries(MERCHANT_DOMAINS)) {
    if (domain.endsWith(`.${k}`) || domain === k) return v;
  }
  // Try to extract display name from "Display Name <email@domain.com>" format
  const displayNameMatch = rawFrom.match(/^"?([^"<]+?)"?\s*</);
  if (displayNameMatch) {
    const name = displayNameMatch[1].trim();
    // Clean up common patterns like "Team at Company", "Company Receipts", etc.
    const cleaned = name
      .replace(/\b(noreply|no-reply|receipts?|billing|invoices?|notifications?|team\s+at|support)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 50) return cleaned;
  }
  // Fall back to domain-based name
  const parts = domain.split('.');
  const main = parts.length >= 2 ? parts[parts.length - 2] : domain;
  return main.charAt(0).toUpperCase() + main.slice(1);
}

function extractAmount(text: string): { amount: number | null; currency: string } {
  // Patterns ordered from most specific to least specific
  const pats = [
    // "Total: $12.99" or "Amount charged: £9.99" or similar label + value
    /(?:total|amount\s*(?:charged|due|paid)|charged|paid|price|subtotal|grand\s*total)[^\d$£€₦₹¥₩]*[$£€₦₹¥₩]?\s*([\d]{1,6}(?:[,\.][\d]{3})*(?:[.,]\d{1,2})?)/i,
    // Currency symbol immediately before number: $12.99
    /[$£€₦₹¥₩]\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/,
    // Number followed by currency code: 12.99 USD
    /(\d{1,6}(?:,\d{3})*(?:\.\d{2}))\s*(?:USD|GBP|EUR|NGN|CAD|AUD|INR|JPY|KRW|CHF|SEK|NOK|DKK|NZD|SGD|HKD|MXN|BRL|ZAR|AED)\b/i,
  ];

  const currencySymbols: Record<string, string> = {
    '$': 'USD', '£': 'GBP', '€': 'EUR', '₦': 'NGN', '₹': 'INR', '¥': 'JPY', '₩': 'KRW',
  };
  const currencyCodes = /USD|GBP|EUR|NGN|CAD|AUD|INR|JPY|KRW|CHF|SEK|NOK|DKK|NZD|SGD|HKD|MXN|BRL|ZAR|AED/i;

  for (const pat of pats) {
    const m = text.match(pat);
    if (!m) continue;

    // Normalise the number: handle both comma-as-thousands (1,234.56) and
    // comma-as-decimal (1.234,56 — European format)
    let raw = m[1];
    let amount: number;

    if (/,\d{2}$/.test(raw) && !raw.includes('.')) {
      // European decimal: "1.234,56" → 1234.56
      amount = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    } else {
      // Standard: "1,234.56" → 1234.56
      amount = parseFloat(raw.replace(/,/g, ''));
    }

    // Sanity bounds: $0.50 minimum, $50,000 maximum
    // Anything above $50k is almost certainly a crypto balance, account value,
    // or data-entry error — not a retail purchase.
    if (isNaN(amount) || amount < 0.50 || amount > 50_000) continue;

    // Detect currency from context
    const symMatch = text.match(/[$£€₦₹¥₩]/);
    const codeMatch = text.match(currencyCodes);
    const currency = symMatch
      ? (currencySymbols[symMatch[0]] ?? 'USD')
      : codeMatch
        ? codeMatch[0].toUpperCase()
        : 'USD';

    return { amount, currency };
  }
  return { amount: null, currency: 'USD' };
}

function categorize(subject: string, from: string, body: string): string {
  const t = `${subject} ${from} ${body}`.toLowerCase();
  if (/netflix|spotify|hulu|disney|youtube.*premium|apple.*tv|prime.*video|hbo|paramount|peacock/.test(t)) return 'streaming';
  if (/subscription|saas|software|app|plan|pro|premium|license|seat/.test(t)) return 'software';
  if (/amazon|shopify|etsy|ebay|walmart|target|bestbuy|shop|store|purchase|order/.test(t)) return 'shopping';
  if (/restaurant|food|doordash|grubhub|uber.*eat|coffee|dining|pizza|meal/.test(t)) return 'food';
  if (/uber|lyft|transit|parking|airline|hotel|airbnb|booking|travel|flight|train/.test(t)) return 'travel';
  if (/gym|fitness|health|medical|pharmacy|clinic|dental|doctor/.test(t)) return 'health';
  if (/electricity|water|gas|internet|phone|mobile|utility|isp|broadband/.test(t)) return 'utilities';
  if (/aws|digitalocean|hosting|domain|cloudflare|server|vps|cdn/.test(t)) return 'infrastructure';
  return 'other';
}

function decodeB64(str: string): string {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBodyText(parts: any[]): string {
  let text = '';
  for (const part of parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += decodeB64(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      text += decodeB64(part.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    } else if (part.parts) {
      text += extractBodyText(part.parts);
    }
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

  // Check receipt subject patterns
  if (!RECEIPT_SUBJECT_PATTERNS.some(p => p.test(subject))) return null;
  // Skip newsletters, digests, marketing, crypto alerts
  if (SKIP_SUBJECT_PATTERNS.some(p => p.test(subject))) return null;

  // Check sender domain — skip crypto exchanges entirely
  const domain = extractEmailDomain(from);
  const baseDomain = domain.split('.').slice(-2).join('.');
  if (CRYPTO_EXCHANGE_DOMAINS.has(domain) || CRYPTO_EXCHANGE_DOMAINS.has(baseDomain)) {
    return null;
  }

  let body = msg.payload?.body?.data
    ? decodeB64(msg.payload.body.data).replace(/<[^>]+>/g, ' ')
    : extractBodyText(msg.payload?.parts ?? []);

  // Skip if body contains clear crypto/trading signals
  if (CRYPTO_BODY_PATTERNS.some(p => p.test(body))) return null;

  const combined = `${subject}\n${body}`;

  const { amount, currency } = extractAmount(combined);

  const invM = combined.match(/(?:invoice|order|receipt|confirmation|ref(?:erence)?)\s*(?:#|no\.?|num(?:ber)?)?\s*:?\s*([A-Z0-9\-_]{4,30})/i);
  const ordM = combined.match(/order\s*(?:id|#|no\.?)?\s*:?\s*([A-Z0-9\-_]{6,30})/i);
  const payM = combined.match(/(?:paid\s*(?:with|via)|payment\s*method)\s*:?\s*([\w\s]{3,30})/i);

  let purchaseDate = new Date().toISOString().split('T')[0];
  try {
    const d = new Date(date);
    if (!isNaN(d.getTime())) purchaseDate = d.toISOString().split('T')[0];
  } catch { /* ok */ }

  const warYr = combined.match(/(\d+)\s*-?\s*year\s*(?:limited\s*)?warranty/i);
  const warMo = combined.match(/(\d+)\s*-?\s*month\s*(?:limited\s*)?warranty/i);
  const warrantyMonths = warYr ? parseInt(warYr[1]) * 12 : warMo ? parseInt(warMo[1]) : null;

  return {
    merchantName: getMerchantName(domain, from),
    amount,
    currency,
    purchaseDate,
    category: categorize(subject, from, body),
    invoiceNumber: invM?.[1] ?? null,
    orderId: ordM?.[1] ?? null,
    paymentMethod: payM?.[1]?.trim().slice(0, 50) ?? null,
    warrantyMonths,
    rawSubject: subject,
    rawFrom: from,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

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
      res.status(403).json({
        error: 'Free plan allows 1 Gmail account. Upgrade to Pro for unlimited Gmail accounts.',
        limitReached: true,
        limit: 1,
        feature: 'gmail_accounts',
      });
      return;
    }
  }

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

  if (!isValidEncryptionKey(ENCRYPTION_KEY)) {
    console.error('[Gmail] ENCRYPTION_KEY is missing or is not a valid 64-character hex string');
    logEncryptionKeyDiagnostics('oauth_callback');
    res.redirect(`${frontendUrl}/settings?tab=gmail&error=encryption_key_invalid`);
    return;
  }

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

    // Kick off initial scan immediately after connection
    if (newAccount) {
      runGmailScan(newAccount, userId, false, true).catch(err =>
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
  if (!isValidEncryptionKey(ENCRYPTION_KEY)) {
    logEncryptionKeyDiagnostics('gmail_scan');
    res.status(503).json({ error: 'Encryption not configured correctly. ENCRYPTION_KEY must be a 64-character hex string.' });
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

  const { data: userPlan } = await supabaseAdmin.from('profiles').select('plan_id').eq('id', req.userId).single();
  const isPro = userPlan?.plan_id === 'pro';

  res.json({
    status: 'scanning',
    message: isPro
      ? `Deep inbox scan started. We'll scan up to ${PRO_SCAN_LIMIT.toLocaleString()} messages from your Gmail history — this may take a few minutes.`
      : `Inbox scan started (Free plan: up to ${FREE_SCAN_LIMIT} messages). Upgrade to Pro to scan your full Gmail history.`,
    accountEmail: account.email,
    isPro,
    scanLimit: isPro ? PRO_SCAN_LIMIT : FREE_SCAN_LIMIT,
  });

  runGmailScan(account, req.userId, forceRescan, false).catch(err =>
    console.error('[Gmail Scan] Unhandled error:', err)
  );
});

export async function runGmailScan(
  account: any,
  userId: string,
  forceRescan: boolean,
  isInitialScan: boolean,
): Promise<void> {
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(account);
  } catch (err: any) {
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId, type: 'gmail_scan_failed', description: err.message,
    });
    return;
  }

  // Determine plan
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('plan_id').eq('id', userId).single();
  const isPro = profile?.plan_id === 'pro';

  // For background rescans of Free users, only look at emails newer than the
  // last scan to avoid repeatedly hitting the same 150-message cap.
  let afterDate: string | null = null;
  if (!isInitialScan && !forceRescan && account.last_scanned_at) {
    afterDate = new Date(account.last_scanned_at).toISOString().split('T')[0];
  }

  const totalCap = isPro ? PRO_SCAN_LIMIT : FREE_SCAN_LIMIT;
  const perQueryCap = isPro ? PRO_SCAN_LIMIT : FREE_SCAN_LIMIT * 2;

  console.log(`[Gmail Scan] ${account.email}: plan=${profile?.plan_id ?? 'free'}, totalCap=${totalCap}, isInitial=${isInitialScan}, afterDate=${afterDate ?? 'none'}`);

  // How many receipts does this Free user already have?
  let currentReceiptCount = 0;
  if (!isPro) {
    const { count } = await supabaseAdmin
      .from('receipts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    currentReceiptCount = count ?? 0;
    if (currentReceiptCount >= FREE_RECEIPT_LIMIT) {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId, type: 'gmail_scan_limit_reached',
        description: `Receipt storage limit reached (${FREE_RECEIPT_LIMIT}). No new receipts imported. Upgrade to Pro for unlimited storage.`,
        metadata: { currentCount: currentReceiptCount, limit: FREE_RECEIPT_LIMIT },
      });
      console.log(`[Gmail Scan] ${account.email}: Free limit already reached (${currentReceiptCount}/${FREE_RECEIPT_LIMIT}), skipping scan`);
      return;
    }
  }

  // Existing Gmail message IDs to skip
  const { data: existing } = await supabaseAdmin
    .from('receipts').select('gmail_message_id').eq('user_id', userId).not('gmail_message_id', 'is', null);
  const alreadyImported = new Set((existing ?? []).map((r: any) => r.gmail_message_id));

  // Build search queries — add after: date filter for background rescans
  const afterFilter = afterDate ? ` after:${afterDate.replace(/-/g, '/')}` : '';
  const gmailQueries = [
    `subject:(receipt OR "order confirmation" OR invoice OR "payment confirmation" OR "order confirmed") -in:spam -in:trash${afterFilter}`,
    `subject:("subscription confirmed" OR "subscription renewed" OR "trial started" OR warranty) -in:spam -in:trash${afterFilter}`,
    `subject:("shipping confirmation" OR "your shipment" OR "your package") -in:spam -in:trash${afterFilter}`,
  ];

  let allIds: string[] = [];
  for (const q of gmailQueries) {
    try {
      const ids = await fetchAllMessageIds(q, accessToken, perQueryCap);
      allIds.push(...ids);
    } catch (e: any) { console.warn('[Gmail Scan] Search error:', e.message); }
    await new Promise(r => setTimeout(r, 250));
  }

  allIds = [...new Set(allIds)];
  if (!forceRescan) allIds = allIds.filter(id => !alreadyImported.has(id));
  allIds = allIds.slice(0, totalCap);

  console.log(`[Gmail Scan] ${account.email}: ${allIds.length} candidate messages to process`);

  let importedCount = 0, skippedCount = 0, failedCount = 0, limitStoppedCount = 0;

  await supabaseAdmin.from('activity_logs').insert({
    user_id: userId, type: 'gmail_scan_started',
    description: `Scanning ${allIds.length} messages (${isPro ? 'Pro — full history' : `Free — up to ${FREE_SCAN_LIMIT}`})`,
    metadata: { total: allIds.length, isPro, forceRescan, isInitialScan, afterDate },
  });

  let freeLimitReached = false;

  for (let i = 0; i < allIds.length; i += 10) {
    // Re-check Free limit every batch to account for concurrent inserts
    if (!isPro && !freeLimitReached) {
      const { count: nowCount } = await supabaseAdmin
        .from('receipts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      if ((nowCount ?? 0) >= FREE_RECEIPT_LIMIT) {
        freeLimitReached = true;
        limitStoppedCount = allIds.length - i;
        console.log(`[Gmail Scan] ${account.email}: Free receipt limit reached at batch ${i}/${allIds.length}`);
      }
    }

    await Promise.all(allIds.slice(i, i + 10).map(async (msgId) => {
      if (freeLimitReached) {
        // Count remaining as "limit stopped" but don't abort the loop so we
        // can update last_scanned_at and log the completion accurately.
        return;
      }
      try {
        const msg = await gmailFetch(`/messages/${msgId}?format=full`, accessToken);
        const parsed = parseMessage(msg);
        if (!parsed || !parsed.amount) { skippedCount++; return; }

        const warrantyEnd = parsed.warrantyMonths
          ? (() => {
              const d = new Date(parsed.purchaseDate);
              d.setMonth(d.getMonth() + parsed.warrantyMonths!);
              return d.toISOString().split('T')[0];
            })()
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

        // Auto-detect subscription — but only create if within plan limits
        const isSubscriptionEmail = /subscription|recurring|monthly|annual|yearly|auto-renew/i.test(
          `${parsed.rawSubject}${parsed.rawFrom}`
        );
        if (isSubscriptionEmail) {
          const canAddSub = isPro || await (async () => {
            const { count } = await supabaseAdmin.from('subscriptions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId).eq('status', 'active');
            return (count ?? 0) < 5;
          })();
          if (canAddSub) {
            await supabaseAdmin.from('subscriptions').upsert({
              user_id: userId, name: parsed.merchantName, merchant_name: parsed.merchantName,
              monthly_price: parsed.amount, currency: parsed.currency,
              billing_cycle: /annual|yearly/i.test(parsed.rawSubject) ? 'yearly' : 'monthly',
              category: parsed.category, status: 'active',
            }, { onConflict: 'user_id,name', ignoreDuplicates: true });
          }
        }

        // Auto-create warranty record — respect plan limits
        if (parsed.warrantyMonths && warrantyEnd) {
          const canAddWarranty = isPro || await (async () => {
            const { count } = await supabaseAdmin.from('warranties')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId);
            return (count ?? 0) < FREE_WARRANTY_LIMIT;
          })();
          if (canAddWarranty) {
            await supabaseAdmin.from('warranties').upsert({
              user_id: userId, product_name: parsed.merchantName, merchant_name: parsed.merchantName,
              purchase_date: parsed.purchaseDate, warranty_end_date: warrantyEnd,
              warranty_months: parsed.warrantyMonths,
              status: new Date(warrantyEnd) > new Date() ? 'active' : 'expired',
            }, { onConflict: 'user_id,product_name', ignoreDuplicates: true });
          }
        }
      } catch (e: any) { console.warn('[Gmail Scan] Message error:', e.message); failedCount++; }
    }));

    const processed = Math.min(i + 10, allIds.length);
    if (processed % 100 === 0 || processed === allIds.length) {
      console.log(`[Gmail Scan] ${account.email}: progress ${processed}/${allIds.length} — ${importedCount} imported, ${skippedCount} skipped, ${freeLimitReached ? 'LIMIT REACHED' : ''}`);
    }

    if (i + 10 < allIds.length) await new Promise(r => setTimeout(r, 200));
  }

  await supabaseAdmin.from('email_accounts')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', account.id);

  const completionDescription = freeLimitReached
    ? `Scan complete: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed. ` +
      `Free plan receipt limit (${FREE_RECEIPT_LIMIT}) reached — ${limitStoppedCount} emails not imported. Upgrade to Pro for unlimited receipt storage.`
    : `Scan complete: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed (of ${allIds.length} candidates)`;

  await supabaseAdmin.from('activity_logs').insert({
    user_id: userId, type: 'gmail_scan_complete',
    description: completionDescription,
    metadata: {
      importedCount, skippedCount, failedCount, total: allIds.length,
      isPro, forceRescan, isInitialScan,
      freeLimitReached, limitStoppedCount,
    },
  });

  // Create an in-app notification if the Free limit was hit
  if (freeLimitReached) {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId, type: 'plan_limit',
      title: `Receipt storage limit reached (${FREE_RECEIPT_LIMIT} receipts)`,
      body: `Your Gmail scan found more receipts, but the Free plan stores up to ${FREE_RECEIPT_LIMIT}. ` +
        `Upgrade to Pro for unlimited storage and full Gmail history scanning.`,
      is_read: false,
      metadata: { type: 'receipt_limit', limit: FREE_RECEIPT_LIMIT, importedCount },
    }).catch(() => {});
  }

  console.log(`[Gmail Scan] ${account.email}: DONE — ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed${freeLimitReached ? ` (limit reached, ${limitStoppedCount} stopped)` : ''}`);
}

router.delete('/api/gmail/accounts/:id', requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;

  const { data: account } = await supabaseAdmin
    .from('email_accounts')
    .select('access_token_enc, refresh_token_enc, email')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single();

  if (account && isValidEncryptionKey(ENCRYPTION_KEY)) {
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
