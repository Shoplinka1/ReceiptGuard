/**
 * GET /api/exchange-rates
 *
 * Returns live exchange rates relative to USD for the 15 currencies
 * supported by ReceiptGuard. Fetches from open.er-api.com (free tier,
 * no API key required). Rates are cached in-memory for 2 hours.
 *
 * On any fetch failure the endpoint returns the last known cached rates
 * (if available) or 1:1 fallback rates, with `stale: true` so the client
 * can suppress misleading conversions.
 */
import { Router, type IRouter } from 'express';
import { logger } from '../lib/logger';

const router: IRouter = Router();

const SUPPORTED = [
  'USD','EUR','GBP','NGN','CAD','AUD','JPY','INR',
  'ZAR','AED','CHF','SEK','NOK','DKK','PLN',
];
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

let cachedRates: Record<string, number> | null = null;
let cachedAt = 0;

/** 1:1 fallback — all conversions become identity so no incorrect numbers appear. */
const FALLBACK: Record<string, number> = Object.fromEntries(SUPPORTED.map(c => [c, 1]));

export async function fetchRates(): Promise<{ rates: Record<string, number>; stale: boolean }> {
  const now = Date.now();
  if (cachedRates && now - cachedAt < CACHE_TTL_MS) {
    return { rates: cachedRates, stale: false };
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { result: string; rates: Record<string, number> };
    if (json.result !== 'success' || !json.rates) throw new Error('Unexpected response shape');

    const rates: Record<string, number> = {};
    for (const code of SUPPORTED) rates[code] = json.rates[code] ?? 1;
    // Always include USD as the base
    rates['USD'] = 1;

    cachedRates = rates;
    cachedAt = now;
    logger.info({ currencies: SUPPORTED.length }, '[ExchangeRates] rates refreshed from open.er-api.com');
    return { rates, stale: false };
  } catch (err: any) {
    logger.warn({ err: err?.message }, '[ExchangeRates] fetch failed — returning cached/fallback rates');
    return { rates: cachedRates ?? FALLBACK, stale: true };
  }
}

// Public endpoint — no auth required (rates are not user-specific)
router.get('/api/exchange-rates', async (_req, res): Promise<void> => {
  const { rates, stale } = await fetchRates();
  res.json({
    base: 'USD',
    rates,
    stale,
    updatedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
  });
});

export default router;
