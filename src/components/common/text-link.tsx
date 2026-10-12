import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

type TextLinkProps = {
  to: string;
  /** Opens in another tab, so a half-filled form is not lost. Announced to screen readers. */
  newTab?: boolean;
  className?: string;
  children: ReactNode;
};

/** A link inside running text: brand colour as text plus underline, never colour alone. */
export function TextLink({ to, newTab = false, className, children }: TextLinkProps) {
  return (
    <Link
      to={to}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener' : undefined}
      className={cn(
        'rounded-[0.25rem] font-semibold text-primary-text underline underline-offset-4',
        className,
      )}
    >
      {children}
      {newTab && <span className="sr-only"> (se abre en otra pestaña)</span>}
    </Link>
  );
}
