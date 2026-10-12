/**
 * The public look-ups where the data a distributor declares is compared by hand (PLAN 2.11).
 * Home pages only: the inner addresses of these sites change, and a link that guesses one would
 * break (or mislead) without anybody noticing. One place, so the platform and the founder open
 * the same address.
 */
export const OFFICIAL_SOURCES = {
  taxId: 'https://www.sunat.gob.pe',
  hydrocarbonsRegistry: 'https://www.osinergmin.gob.pe',
} as const;
