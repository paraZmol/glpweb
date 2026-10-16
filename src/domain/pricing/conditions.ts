import { type Check, checkVisibleText } from '../tenancy/field-checks';
import { PROMOTION_CONDITIONS_MAX_LENGTH } from './constants';

/**
 * Phrases of invented urgency the conditions refuse (marketing §3.5 and H5): Hornilla does not
 * count stock, so they could not be true. Compared without accents, capitals or repeated spaces.
 * firebase/firestore.rules refuses the same list (`hasNoBlockedPhrase()`).
 */
export const BLOCKED_PHRASES = [
  'hasta agotar',
  'ultimas unidades',
  'unidades limitadas',
  'quedan pocas',
] as const;

const COMBINING_MARKS = /\p{M}/gu;
const SPACES = /\s+/g;

function comparable(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().replace(SPACES, ' ');
}

export function hasBlockedPhrase(text: string): boolean {
  const plain = comparable(text);
  return BLOCKED_PHRASES.some((phrase) => plain.includes(phrase));
}

/** Optional text the customer reads whole: up to 140, visible, with no blocked phrase. */
export function checkConditions(conditions: string): Check {
  const text = checkVisibleText(conditions, 0, PROMOTION_CONDITIONS_MAX_LENGTH);
  if (text) return text;
  return hasBlockedPhrase(conditions) ? 'blockedPhrase' : null;
}
