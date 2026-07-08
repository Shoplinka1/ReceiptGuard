/**
 * Currency formatting helper.
 *
 * Amounts in the database are stored as plain numbers per-record currency
 * (receipts/subscriptions store their own `currency` field). The user's
 * Settings → General → Currency preference is the *display* currency used
 * for aggregate figures (dashboard totals, etc.) where no per-record
 * currency is available. We do not attempt FX conversion — this only
 * controls which currency symbol/format is shown.
 */
export function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  const value = Number(amount ?? 0)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    // Unknown/invalid ISO currency code — fall back to a plain number with the code.
    return `${value.toFixed(2)} ${currency || 'USD'}`
  }
}
