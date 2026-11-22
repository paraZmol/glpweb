/**
 * An amount as a person types it in soles — "52", "52.5", "52,50", "S/ 52.00", "1,250.00" — in
 * integer cents, or null when it is not one. Read digit by digit from the text: never through a
 * float, so "0.29" is 29 and not 28.999…. More than two decimals, a sign or letters are refused.
 * A comma followed by exactly three digits groups thousands; any other comma is the decimal mark.
 */
const CURRENCY_PREFIX = /^S\/\s*/i;
const GROUPED = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;
const PLAIN = /^(\d+)(?:[.,](\d{1,2}))?$/;
const CENTS_DIGITS = 2;

export function parseMoneyCents(raw: string): number | null {
  const text = raw.trim().replace(CURRENCY_PREFIX, '');
  const ungrouped = GROUPED.test(text) ? text.replaceAll(',', '') : text;
  const match = PLAIN.exec(ungrouped);
  if (!match) return null;
  const [, units = '', decimals = ''] = match;
  const cents = Number(`${units}${decimals.padEnd(CENTS_DIGITS, '0')}`);
  return Number.isSafeInteger(cents) ? cents : null;
}
