import { Check, type LucideIcon, Navigation, Pause, TriangleAlert, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { GLYPH_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

export type SystemState = 'free' | 'busy' | 'paused' | 'offline' | 'danger';

// System states of ui-system §5.3: they never follow the brand, and always carry glyph AND text.
const STATES: Record<SystemState, { icon: LucideIcon; className: string }> = {
  free: {
    icon: Check,
    className: 'bg-[color-mix(in_srgb,var(--state-free)_14%,var(--card))] text-state-free-text',
  },
  busy: {
    icon: Navigation,
    className: 'bg-[color-mix(in_srgb,var(--state-busy)_14%,var(--card))] text-state-busy-text',
  },
  paused: {
    icon: Pause,
    className: 'bg-[color-mix(in_srgb,var(--state-paused)_14%,var(--card))] text-state-paused-text',
  },
  offline: {
    icon: WifiOff,
    className:
      'bg-[color-mix(in_srgb,var(--state-offline)_14%,var(--card))] text-state-offline-text',
  },
  danger: {
    icon: TriangleAlert,
    className: 'bg-[color-mix(in_srgb,var(--state-danger)_14%,var(--card))] text-state-danger-text',
  },
};

type StateChipProps = {
  state: SystemState;
  children: ReactNode;
  className?: string;
};

/** Pill that names a state: tinted background, 13 px bold text and its 12 px glyph. */
export function StateChip({ state, children, className }: StateChipProps) {
  const { icon: Icon, className: tone } = STATES[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 text-[0.8125rem] font-bold whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" strokeWidth={GLYPH_STROKE} />
      {children}
    </span>
  );
}
