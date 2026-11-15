import { Link, useLocation } from 'react-router';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { NavItem } from './nav-items';

/**
 * Phone: the screens that share one destination of the bottom bar (the catalogue and its
 * promotions, the plant stock and the vehicles), as segments on top of them. The current one is
 * raised (shape, not colour alone) and carries `aria-current`. Desktop lists them in the side bar.
 */
export function SectionTabs({ items }: { items: readonly NavItem[] }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Secciones" className="mb-5">
      <ul className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              aria-current={pathname === to ? 'page' : undefined}
              className={cn(
                'press flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-[0.9375rem] font-semibold',
                'text-muted-foreground transition-colors motion-fast hover:text-foreground',
                'aria-[current=page]:bg-card aria-[current=page]:font-bold aria-[current=page]:text-foreground aria-[current=page]:shadow-card',
                'in-data-[ambient=driver]:aria-[current=page]:bg-foreground in-data-[ambient=driver]:aria-[current=page]:text-background',
              )}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
