import { LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button as UiButton } from '@/components/ui/button';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

type CriticalButtonProps = Omit<ComponentProps<typeof UiButton>, 'variant' | 'size'> & {
  icon: LucideIcon;
  loading?: boolean;
  loadingLabel?: string;
};

/**
 * The driver's one action per screen ("Ya llegué", "Aceptar", "Cobrado"): 72 px tall, ink
 * background, and the brand only in the icon tile (ui-system §13). Pin it to the bottom.
 */
export function CriticalButton({
  icon: Icon,
  loading = false,
  loadingLabel = 'Procesando…',
  disabled,
  className,
  children,
  ...props
}: CriticalButtonProps) {
  return (
    <UiButton
      {...props}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      aria-busy={loading || undefined}
      className={cn(
        'press h-18 w-full justify-between rounded-xl border-0 bg-foreground pr-2.5 pl-7 text-left',
        'font-heading text-[1.625rem] font-extrabold text-background shadow-raised motion-instant',
        'hover:bg-foreground active:not-aria-[haspopup]:translate-y-0',
        'focus-visible:ring-0 focus-visible:outline-3 focus-visible:outline-offset-2',
        'focus-visible:outline-ring focus-visible:outline-solid',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        loading && 'data-disabled:opacity-100',
        className,
      )}
    >
      <span>{children}</span>
      <span className="grid size-13 shrink-0 place-items-center rounded-[1.125rem] bg-primary text-primary-foreground">
        {loading ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-7 animate-spin"
            strokeWidth={ICON_STROKE}
          />
        ) : (
          <Icon aria-hidden="true" className="size-7" strokeWidth={ICON_STROKE} />
        )}
      </span>
      {loading && <span className="sr-only">{loadingLabel}</span>}
    </UiButton>
  );
}
