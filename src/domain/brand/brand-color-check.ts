import { contrastRatio, mixColors, normalizeHex } from './color';
import {
  BRAND_THEME_BASES,
  BRAND_THEMES,
  type BrandThemeName,
  deriveBrand,
  HORNILLA_BRAND_COLOR,
} from './derive-brand';

/**
 * A brand colour is refused when its fill cannot be told apart from the page: less than 2:1
 * against the light or the dark background (decision of 2026-10-10, ui-system "Decisiones
 * posteriores"). The derivation guarantees readable text, not a visible button.
 */
export const MIN_BRAND_FILL_CONTRAST = 2;

const SUGGESTION_STEP = 0.02;
const SUGGESTION_MAX_STEPS = 50;
const WHITE = '#ffffff';
const BLACK = '#000000';

export type BrandColorCheck =
  | { ok: true; color: string }
  | { ok: false; reason: 'invalid' }
  | {
      ok: false;
      reason: 'tooFaint';
      /** The theme whose background swallows the colour. */
      theme: BrandThemeName;
      /** Closest tone of the same colour that passes in both themes. */
      suggestion: string;
    };

/** The first theme whose background swallows the derived fill, or null when both show it. */
export function faintThemeOf(color: string): BrandThemeName | null {
  const derived = deriveBrand(color);
  const failing = BRAND_THEMES.find((theme) => {
    const background = BRAND_THEME_BASES[theme].background;
    return contrastRatio(derived[theme].fill, background) < MIN_BRAND_FILL_CONTRAST;
  });
  return failing ?? null;
}

/** Walks the colour away from the background that swallows it until both themes accept it. */
function closestVisibleTone(color: string, theme: BrandThemeName): string {
  const away = theme === 'light' ? BLACK : WHITE;
  for (let step = 1; step <= SUGGESTION_MAX_STEPS; step += 1) {
    const candidate = mixColors(color, away, step * SUGGESTION_STEP);
    if (faintThemeOf(candidate) === null) return candidate;
  }
  return HORNILLA_BRAND_COLOR;
}

export function checkBrandColor(raw: string): BrandColorCheck {
  const color = normalizeHex(raw);
  if (color === null) return { ok: false, reason: 'invalid' };
  const theme = faintThemeOf(color);
  if (theme === null) return { ok: true, color };
  return { ok: false, reason: 'tooFaint', theme, suggestion: closestVisibleTone(color, theme) };
}
