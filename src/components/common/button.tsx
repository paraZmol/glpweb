import { LoaderCircle } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Link } from 'react-router';
import { Button as UiButton, buttonVariants } from '@/components/ui/button';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

// Hornilla's layer over the shadcn button (ui-system §8): pill, 48 px tall, Gabarito.
const BASE = [
  'press relative rounded-full border-0 font-heading font-bold motion-instant',
  'active:not-aria-[haspopup]:translate-y-0',
  'focus-visible:ring-0 focus-visible:outline-3 focus-visible:outline-offset-2',
  'focus-visible:outline-ring focus-visible:outline-solid',
  'data-disabled:pointer-events-none data-disabled:opacity-50',
  "[&_svg:not([class*='size-'])]:size-5",
].join(' ');

const VARIANTS = {
  /** The one main action of a screen. Its text is ink, never white. */
  primary:
    'bg-primary text-primary-foreground shadow-brand hover:bg-primary hover:brightness-105 hover:saturate-105',
  ink: 'bg-foreground text-background hover:bg-foreground/90',
  soft: 'bg-primary-soft text-primary-text hover:bg-primary-soft hover:brightness-97',
  line: 'bg-card text-foreground inset-ring-[1.5px] inset-ring-border hover:bg-muted',
  /** Low-emphasis text action; underlined so it never depends on colour alone. */
  quiet:
    'bg-transparent text-foreground underline underline-offset-4 hover:bg-muted [&>span]:underline [&>span]:underline-offset-4',
} as const;

// A finger needs 44 px (ui-system §3). The small size keeps its 40 px look and reaches them with
// an invisible area around it, so it grows nowhere: not on a phone, not on a desktop.
const TOUCH_AREA =
  'before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2';

const SIZES = {
  sm: `h-10 gap-1.5 px-4 text-[0.9375rem] ${TOUCH_AREA}`,
  md: 'h-12 gap-2 px-5 text-[1.0625rem]',
  lg: 'h-14 gap-2 px-7 text-[1.1875rem]',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

type Look = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

export function buttonClassName({ variant = 'primary', size = 'md', className }: Look = {}) {
  return cn(buttonVariants(), BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = Omit<ComponentProps<typeof UiButton>, 'variant' | 'size' | 'className'> &
  Look & {
    /** Shows a spinner in place of the label; the button keeps its width and ignores taps. */
    loading?: boolean;
    /** What a screen reader hears while it is loading. */
    loadingLabel?: string;
  };

export function Button({
  variant,
  size,
  className,
  loading = false,
  loadingLabel = 'Procesando…',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <UiButton
      {...props}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      aria-busy={loading || undefined}
      className={cn(
        BASE,
        VARIANTS[variant ?? 'primary'],
        SIZES[size ?? 'md'],
        loading && 'data-disabled:opacity-100',
        className,
      )}
    >
      <span className={cn('inline-flex items-center gap-[inherit]', loading && 'invisible')}>
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <LoaderCircle aria-hidden="true" className="animate-spin" strokeWidth={ICON_STROKE} />
          <span className="sr-only">{loadingLabel}</span>
        </span>
      )}
    </UiButton>
  );
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & Look;

/** A navigation that looks like a button. It is a link: it opens in a new tab, has a URL. */
export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link {...props} className={buttonClassName({ variant, size, className })} />;
}
