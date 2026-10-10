/**
 * Colours offered when a distributor picks its brand (PLAN 2.2). They are data, not tokens: the
 * six test colours of ui-system §6, which cover a dark, a vivid and a light brand. A test proves
 * that every one of them passes `checkBrandColor`.
 */
export const SUGGESTED_BRAND_COLORS = [
  { name: 'Mandarina', color: '#ff6a13' },
  { name: 'Rojo rocoto', color: '#e11d48' },
  { name: 'Verde', color: '#0e8f6b' },
  { name: 'Azul', color: '#1757d6' },
  { name: 'Ámbar', color: '#f59e0b' },
  { name: 'Tinta', color: '#1f2937' },
] as const;
