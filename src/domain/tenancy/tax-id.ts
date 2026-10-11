// RUC: the Peruvian taxpayer number (SUNAT). Eleven digits: a two-digit kind of taxpayer, eight
// digits of identity and one check digit. A natural person's RUC (prefix 10) carries its DNI, so
// it is personal data: it lives only in `private/settings` (PLAN 2.11).

export const RUC_LENGTH = 11;

/** 10 natural person · 15, 16, 17 other natural-person documents · 20 company. */
export const RUC_PREFIXES = ['10', '15', '16', '17', '20'] as const;

/** Weights of the first ten digits (modulus 11), as published by SUNAT. */
const CHECK_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
const MODULUS = 11;
const NOT_A_DIGIT = /\D+/g;
const RUC_SHAPE = /^\d{11}$/;

/** Keeps the digits only: people type the RUC with spaces or hyphens. */
export function normalizeRuc(raw: string): string {
  return raw.replace(NOT_A_DIGIT, '');
}

/** The check digit that belongs to the first ten digits of a RUC. */
export function rucCheckDigit(firstTenDigits: string): number {
  const sum = CHECK_WEIGHTS.reduce(
    (total, weight, index) => total + weight * Number(firstTenDigits[index]),
    0,
  );
  const complement = MODULUS - (sum % MODULUS);
  // 10 and 11 do not fit in one digit: SUNAT maps them to 0 and 1.
  return complement >= MODULUS - 1 ? complement - (MODULUS - 1) : complement;
}

/**
 * True for a well-formed RUC: eleven digits, a known kind of taxpayer and the right check digit.
 * It proves the number was not mistyped, not that it exists or belongs to whoever typed it.
 * firebase/firestore.rules repeats the shape and the prefix, not the check digit.
 */
export function isValidRuc(value: string): boolean {
  if (!RUC_SHAPE.test(value)) return false;
  if (!(RUC_PREFIXES as readonly string[]).includes(value.slice(0, 2))) return false;
  return rucCheckDigit(value) === Number(value[RUC_LENGTH - 1]);
}
