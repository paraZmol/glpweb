import { contrastRatio, mixColors, normalizeHex, nudgeUntilContrast } from './color';

/**
 * Brand colour derivation of the design system (ui-system §6): from the colour a distributor
 * picks, the four tones each theme needs so that text always stays readable.
 */
export const BRAND_THEMES = ['light', 'dark'] as const;
export type BrandThemeName = (typeof BRAND_THEMES)[number];

export interface BrandTones {
  /** Background of the main button → `--primary`. */
  fill: string;
  /** Text on the fill → `--primary-foreground`. */
  on: string;
  /** Tinted background → `--primary-soft`. */
  soft: string;
  /** The brand used as text → `--primary-text`. */
  text: string;
}

export type DerivedBrand = Record<BrandThemeName, BrandTones>;

export const HORNILLA_BRAND_COLOR = '#ff6a13';
const INK = '#14182b';
const WHITE = '#ffffff';
const BLACK = '#000000';

interface ThemeBase {
  background: string;
  mixSurface: string;
  softAmount: number;
  textToward: string;
}

export const BRAND_THEME_BASES: Record<BrandThemeName, ThemeBase> = {
  light: { background: WHITE, mixSurface: WHITE, softAmount: 0.1, textToward: INK },
  dark: { background: '#0d111e', mixSurface: '#222a40', softAmount: 0.16, textToward: WHITE },
};

const MIN_FILL_ON_DARK = 3;
const MIN_TEXT_ON_FILL = 4.5;
const MIN_TEXT_ON_SOFT = 4.6;

function deriveTones(color: string, theme: BrandThemeName): BrandTones {
  const base = BRAND_THEME_BASES[theme];
  const visible =
    theme === 'dark'
      ? nudgeUntilContrast({
          color,
          toward: WHITE,
          against: base.background,
          minContrast: MIN_FILL_ON_DARK,
        })
      : color;
  const on = contrastRatio(visible, INK) >= contrastRatio(visible, WHITE) ? INK : WHITE;
  // When the text does not reach 4.5:1 the fill gives way, never the text.
  const fill = nudgeUntilContrast({
    color: visible,
    toward: on === INK ? WHITE : BLACK,
    against: on,
    minContrast: MIN_TEXT_ON_FILL,
  });
  const soft = mixColors(base.mixSurface, fill, base.softAmount);
  const text = nudgeUntilContrast({
    color: fill,
    toward: base.textToward,
    against: soft,
    minContrast: MIN_TEXT_ON_SOFT,
  });
  return { fill, on, soft, text };
}

/** Tones for both themes. An unreadable value falls back to Hornilla's own mandarin. */
export function deriveBrand(hex: string): DerivedBrand {
  const color = normalizeHex(hex) ?? HORNILLA_BRAND_COLOR;
  return { light: deriveTones(color, 'light'), dark: deriveTones(color, 'dark') };
}

export const BRAND_VARIABLE_PREFIXES = ['brand', 'gas'] as const;
export type BrandVariablePrefix = (typeof BRAND_VARIABLE_PREFIXES)[number];

/**
 * The eight CSS variables `[data-brand]` (or `[data-gas-brand]`) reads in src/index.css. All
 * eight are always present: a missing one would silently inherit Hornilla's colour.
 */
export function brandCssVariables(
  hex: string,
  prefix: BrandVariablePrefix = 'brand',
): Record<string, string> {
  const derived = deriveBrand(hex);
  return Object.fromEntries(
    BRAND_THEMES.flatMap((theme) =>
      Object.entries(derived[theme]).map(([tone, value]) => [
        `--${prefix}-${tone}-${theme}`,
        value,
      ]),
    ),
  );
}
