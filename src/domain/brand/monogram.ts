const MONOGRAM_LENGTH = 2;
const FALLBACK_MONOGRAM = 'H';
const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]/gu;

/** Two-letter monogram of a distributor without a logo: "Gas Demo Norte" → "GD". */
export function monogramOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => [...word.replace(NOT_LETTER_OR_DIGIT, '')])
    .filter((letters) => letters.length > 0);
  const [first = [], second] = words;
  const letters = second ? [first[0], second[0]] : first.slice(0, MONOGRAM_LENGTH);
  return letters.join('').toLocaleUpperCase('es') || FALLBACK_MONOGRAM;
}
