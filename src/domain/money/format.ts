const CENTS_PER_UNIT = 100;

const CURRENCY_SYMBOLS: Record<string, string> = { PEN: 'S/' };

/** Formats integer cents for display, e.g. 3800 → "S/ 38.00". Money is never a float. */
export function formatMoney(amountCents: number, currency = 'PEN'): string {
  if (!Number.isInteger(amountCents)) {
    throw new TypeError(`Money must be integer cents, got ${amountCents}`);
  }
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const sign = amountCents < 0 ? '-' : '';
  const absolute = Math.abs(amountCents);
  const units = Math.floor(absolute / CENTS_PER_UNIT).toLocaleString('en-US');
  const cents = String(absolute % CENTS_PER_UNIT).padStart(2, '0');
  return `${sign}${symbol} ${units}.${cents}`;
}
