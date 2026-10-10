/** Colour maths for brand derivation (WCAG 2.1). Colours travel as lowercase `#rrggbb`. */

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const SHORT_HEX_LENGTH = 4;
const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.03928;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const CONTRAST_OFFSET = 0.05;

export const NUDGE_STEP = 0.06;
export const NUDGE_MAX_STEPS = 40;

type Channels = [number, number, number];

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

/** Expands `#abc` and lowercases. Returns null when the value is not a hex colour. */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!isHexColor(trimmed)) return null;
  if (trimmed.length !== SHORT_HEX_LENGTH) return trimmed;
  const [, r, g, b] = trimmed;
  return `#${r}${r}${g}${g}${b}${b}`;
}

function channelsOf(hex: string): Channels {
  const digits = (normalizeHex(hex) ?? '#000000').slice(1);
  return [0, 2, 4].map((start) => Number.parseInt(digits.slice(start, start + 2), 16)) as Channels;
}

function hexOf(channels: readonly number[]): string {
  return `#${channels.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

export function relativeLuminance(hex: string): number {
  return channelsOf(hex).reduce((sum, channel, index) => {
    const value = channel / CHANNEL_MAX;
    const linear = value <= LINEAR_THRESHOLD ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * (LUMINANCE_WEIGHTS[index] ?? 0);
  }, 0);
}

/** WCAG contrast ratio between two colours, from 1 (same) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [lighter = 0, darker = 0] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (left, right) => right - left,
  );
  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}

/** Linear interpolation in sRGB: `amount` 0 returns `from`, 1 returns `to`. */
export function mixColors(from: string, to: string, amount: number): string {
  const target = channelsOf(to);
  return hexOf(
    channelsOf(from).map((value, index) => value + ((target[index] ?? 0) - value) * amount),
  );
}

export interface Nudge {
  color: string;
  toward: string;
  against: string;
  minContrast: number;
}

/** Moves `color` towards `toward` in small steps until it reaches `minContrast` with `against`. */
export function nudgeUntilContrast({ color, toward, against, minContrast }: Nudge): string {
  let current = color;
  for (let step = 0; step < NUDGE_MAX_STEPS; step += 1) {
    if (contrastRatio(current, against) >= minContrast) break;
    current = mixColors(current, toward, NUDGE_STEP);
  }
  return current;
}
