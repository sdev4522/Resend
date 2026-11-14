/**
 * Clean SaaS psychological currency formatting.
 * Avoids awkward decimals (e.g. renders ₹499 instead of ₹499.00).
 */
export function formatCurrencyAmount(
  amount: number | string | undefined | null,
  currency: string = 'USD',
  symbol: string = '$'
): string {
  if (amount === undefined || amount === null || amount === '') return `${symbol}0`;
  const num = Number(amount);
  if (isNaN(num)) return `${symbol}0`;

  const normCurr = (currency || 'USD').toUpperCase();
  // INR and whole amounts should never have decimal fractions
  if (normCurr === 'INR' || normCurr === 'JPY' || normCurr === 'KRW' || num % 1 === 0) {
    return `${symbol}${Math.round(num).toLocaleString('en-US')}`;
  }

  return `${symbol}${num.toFixed(2)}`;
}

/**
 * Formats an amount in its own currency with the right symbol (₹, $, €, AED…).
 * Keeps up to 2 decimals so admin totals are exact.
 */
export function formatMoney(amount: number | string | undefined | null, currency: string = 'INR'): string {
  const num = Number(amount ?? 0);
  const code = (currency || 'INR').toUpperCase();
  const value = Number.isFinite(num) ? num : 0;
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}
