import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

const TONES = {
  /** Something failed: announced at once. */
  error: {
    icon: TriangleAlert,
    role: 'alert',
    box: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
  },
  /** Context the person should read before acting. */
  info: { icon: Info, role: 'status', box: 'bg-flame-soft text-flame-text' },
  /** It worked. */
  success: {
    icon: CircleCheck,
    role: 'status',
    box: 'bg-[color-mix(in_srgb,var(--state-free)_14%,var(--card))] text-state-free-text',
  },
} as const;

type InlineAlertProps = {
  tone: keyof typeof TONES;
  children: ReactNode;
  className?: string;
};

/** A message inside the page, next to what it talks about. Icon and text, never colour alone. */
export function InlineAlert({ tone, children, className }: InlineAlertProps) {
  const { icon: Icon, role, box } = TONES[tone];
  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-2.5 rounded-lg p-3.5 text-[0.9375rem] font-semibold',
        box,
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={ICON_STROKE} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
