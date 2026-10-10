import { useId } from 'react';
import { cn } from '@/lib/utils';

const BRAND_NAME = 'Hornilla';
const DEFAULT_SIZE_PX = 32;
const WORDMARK_SIZE_RATIO = 0.72;
const WORDMARK_GAP_RATIO = 0.25;

// Geometry on a 32-unit grid: a burner crown of 14 teeth seen from above and a flame drop.
const CROWN_RADIUS = 12.4;
const CROWN_STROKE = 3.4;
const CROWN_TEETH_DASH = '2.1 3.465';
const CROWN_ROTATION = 'rotate(-8 16 16)';
const FLAME_PATH = 'M16 7.6c2.9 3.3 4.9 5.6 4.9 8.5a4.9 4.9 0 0 1-9.8 0c0-2.9 2-5.2 4.9-8.5z';
const FLAME_STOPS = [
  { offset: 0, color: 'var(--logo-flame-tip)' },
  { offset: 0.42, color: 'var(--logo-flame-mid)' },
  { offset: 0.62, color: 'var(--logo-flame-glow)' },
  { offset: 1, color: 'var(--logo-flame-base)' },
];

type HornillaLogoProps = {
  /** Height of the symbol in px. Minimum 20 (symbol) or 24 (lockup). */
  size?: number;
  /** `symbol`: crown and flame only. `lockup`: symbol plus the word. */
  variant?: 'symbol' | 'lockup';
  /** `mono` paints everything with the current text colour (on brand colour, photos, print). */
  tone?: 'color' | 'mono';
  className?: string;
};

export function HornillaLogo({
  size = DEFAULT_SIZE_PX,
  variant = 'lockup',
  tone = 'color',
  className,
}: HornillaLogoProps) {
  const gradientId = useId();
  const isMono = tone === 'mono';

  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className={cn('inline-flex shrink-0 items-center', className)}
      style={{ gap: size * WORDMARK_GAP_RATIO }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        aria-hidden="true"
        className={cn('shrink-0', !isMono && 'text-flame')}
      >
        {!isMono && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {FLAME_STOPS.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} style={{ stopColor: stop.color }} />
              ))}
            </linearGradient>
          </defs>
        )}
        <circle
          cx="16"
          cy="16"
          r={CROWN_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={CROWN_STROKE}
          strokeDasharray={CROWN_TEETH_DASH}
          transform={CROWN_ROTATION}
        />
        <path d={FLAME_PATH} fill={isMono ? 'currentColor' : `url(#${gradientId})`} />
      </svg>
      {variant === 'lockup' && (
        <span
          aria-hidden="true"
          className="font-heading leading-none font-extrabold tracking-tight"
          style={{ fontSize: size * WORDMARK_SIZE_RATIO }}
        >
          {BRAND_NAME}
        </span>
      )}
    </span>
  );
}
