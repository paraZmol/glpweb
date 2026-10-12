import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { ICON_STROKE } from '@/lib/icons';

type OutsideLinkProps = {
  /** A full address of another site. It never receives where the person came from. */
  href: string;
  children: ReactNode;
};

/** A link to another site: always in another tab, with its icon and said to screen readers. */
export function OutsideLink({ href, children }: OutsideLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-sm font-semibold text-flame-text underline underline-offset-4"
    >
      <ExternalLink aria-hidden="true" className="size-4 shrink-0" strokeWidth={ICON_STROKE} />
      {children}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}
