import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  /** The `h1`: a full sentence ending in a full stop. */
  title: ReactNode;
  lead?: ReactNode;
  /** Office and platform: smaller title (24 → 28 px), as their dense ambient asks. */
  dense?: boolean;
  /** Chips or actions shown beside the title on desktop and under it on a phone. */
  aside?: ReactNode;
};

/** Title block of a screen inside the app (type scale of ui-system §7). */
export function PageHeader({ title, lead, dense = false, aside }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1
          className={cn(
            'font-extrabold',
            dense ? 'text-2xl lg:text-[1.75rem]' : 'text-[2.125rem] lg:text-[2.5rem]',
          )}
        >
          {title}
        </h1>
        {lead && (
          <p className={cn('mt-2 max-w-prose text-muted-foreground', !dense && 'text-lg')}>
            {lead}
          </p>
        )}
      </div>
      {aside}
    </header>
  );
}

/** A panel of the app: client areas round it more (24 px) than the office does (16 px). */
export function Panel({
  dense = false,
  className,
  children,
}: {
  dense?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'bg-card p-5 shadow-card lg:p-7',
        dense ? 'rounded-lg' : 'rounded-xl',
        className,
      )}
    >
      {children}
    </section>
  );
}
