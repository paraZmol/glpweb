import { RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Button } from './button';

const EMPTY_SYMBOL_PX = 64;

type EmptyStateProps = {
  /** One sentence that says what is going on. */
  title: string;
  description?: ReactNode;
  /** The way out: a button or a link. */
  action?: ReactNode;
  /** Replaces the Hornilla symbol (for example, a one-colour gas cylinder). */
  symbol?: ReactNode;
  className?: string;
};

/** Empty pattern of DIRECCION.md: one-colour symbol, what happens, and the way out. */
export function EmptyState({ title, description, action, symbol, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-4', className)}>
      <div className="text-muted-foreground">
        {symbol ?? <HornillaLogo variant="symbol" tone="mono" size={EMPTY_SYMBOL_PX} />}
      </div>
      <div>
        <h2 className="text-2xl font-extrabold">{title}</h2>
        {description && <p className="mt-2 max-w-prose text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type ErrorStateProps = {
  /** What failed, in plain words. */
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  /** Extra way out next to "Reintentar". */
  secondaryAction?: ReactNode;
  /** `h1` when the error is the whole screen; `h2` (default) when it is part of one. */
  titleLevel?: 1 | 2;
  className?: string;
};

/** Error pattern of DIRECCION.md: alert icon, what failed and "Reintentar". */
export function ErrorState({
  title,
  description,
  onRetry,
  secondaryAction,
  titleLevel = 2,
  className,
}: ErrorStateProps) {
  const Title = titleLevel === 1 ? 'h1' : 'h2';
  return (
    <div role="alert" className={cn('rounded-xl bg-card p-6 shadow-card', className)}>
      <TriangleAlert
        aria-hidden="true"
        className="size-8 text-state-danger-text"
        strokeWidth={ICON_STROKE}
      />
      <Title className="mt-3 text-xl font-bold">{title}</Title>
      {description && <p className="mt-1.5 max-w-prose text-muted-foreground">{description}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        {onRetry && (
          <Button variant="ink" onClick={onRetry}>
            <RefreshCw aria-hidden="true" strokeWidth={ICON_STROKE} />
            Reintentar
          </Button>
        )}
        {secondaryAction}
      </div>
    </div>
  );
}
