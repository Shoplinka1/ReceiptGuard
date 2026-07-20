/**
 * Currency helpers for ReceiptGuard.
 *
 * formatCurrency  — format a number in any ISO 4217 currency using Intl.
 * convertAmount   — convert between currencies using live exchange rates
 *                   (rates are relative to USD, e.g. EUR=0.92, NGN=1600).
 * convertByCurrency — sum a per-currency breakdown into a single display currency.
 */

export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'USD',
  locale?: string,
): string {
  const value = Number(amount ?? 0)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    // Unknown/invalid ISO currency code — fall back gracefully.
    return `${value.toFixed(2)} ${currency || 'USD'}`
  }
}

/**
 * Convert an amount from one currency to another using exchange rates
 * relative to USD (as returned by GET /api/exchange-rates).
 *
 * Formula: amount / fromRate * toRate
 * e.g. €45 → USD: 45 / 0.92 * 1 ≈ $48.91
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return amount
  const fromRate = rates[fromCurrency.toUpperCase()] ?? 1
  const toRate = rates[toCurrency.toUpperCase()] ?? 1
  if (fromRate === 0) return amount
  return (amount / fromRate) * toRate
}

/**
 * Convert a per-currency spending breakdown (e.g. { USD: 30, EUR: 45 })
 * into a single total in the given display currency.
 *
 * Returns 0 if rates are empty or all conversions fail.
 */
export function convertByCurrency(
  byCurrency: Record<string, number> | null | undefined,
  displayCurrency: string,
  rates: Record<string, number>,
): number {
  if (!byCurrency || Object.keys(rates).length === 0) return 0
  return Object.entries(byCurrency).reduce((sum, [currency, amount]) => {
    return sum + convertAmount(amount, currency, displayCurrency, rates)
  }, 0)
}
