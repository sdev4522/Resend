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
