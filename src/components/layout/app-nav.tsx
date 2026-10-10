import { NavLink } from 'react-router';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { NavItem } from './nav-items';

const NAV_LABEL = 'Principal';

/** Phone: fixed bar at the bottom, five destinations at most. Hidden from `lg:` up. */
export function BottomNav({ items, isRoomy }: { items: NavItem[]; isRoomy: boolean }) {
  return (
    <nav
      data-bottom-nav=""
      aria-label={NAV_LABEL}
      className="fixed inset-x-0 bottom-0 z-30 bg-card px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-raised lg:hidden"
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold',
                'text-muted-foreground transition-colors motion-fast',
                'aria-[current=page]:text-primary-text',
                isRoomy ? 'min-h-14' : 'min-h-12',
              )}
            >
              <Icon aria-hidden="true" className="size-6" strokeWidth={ICON_STROKE} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Desktop: the same destinations as a vertical list inside the side bar. */
export function SideNav({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label={NAV_LABEL}>
      <ul className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-semibold',
                'text-muted-foreground transition-colors motion-fast hover:bg-muted hover:text-foreground',
                'aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-text',
              )}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
