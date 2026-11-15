import { Link, NavLink, useLocation } from 'react-router';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { NavItem } from './nav-items';

const NAV_LABEL = 'Principal';

// The current destination: brand tint behind, brand colour on the icon, and the label in ink.
// A grey or very dark brand derives a `primary-text` dimmer than the other labels, so the label
// never takes it: the current destination must not look like the disabled one.
const CURRENT_TINT = 'group-aria-[current=page]:bg-primary-soft';
const CURRENT_ICON = 'group-aria-[current=page]:text-primary-text';
// ui-system §13: in the driver ambient ink leads, not the brand: an ink block, inverted glyph.
const DRIVER_CURRENT_BLOCK = 'in-data-[ambient=driver]:group-aria-[current=page]:bg-foreground';
const DRIVER_CURRENT_GLYPH = 'in-data-[ambient=driver]:group-aria-[current=page]:text-background';

/**
 * Whether the destination `to` lights up only on its own path: an area home with another
 * destination under it (`/central` and `/central/catalogo`) must not stay current there too.
 */
export function isExactDestination(to: string, items: readonly NavItem[]): boolean {
  return items.some((other) => other.to.startsWith(`${to}/`));
}

/** Whether `item` is where the person stands, also on a screen it covers (phone). */
export function isCurrentDestination(
  item: NavItem,
  pathname: string,
  items: readonly NavItem[],
): boolean {
  if (item.covers?.includes(pathname)) return true;
  if (pathname === item.to) return true;
  return !isExactDestination(item.to, items) && pathname.startsWith(`${item.to}/`);
}

/** Phone: fixed bar at the bottom, five destinations at most. Hidden from `lg:` up. */
export function BottomNav({ items, isRoomy }: { items: NavItem[]; isRoomy: boolean }) {
  const { pathname } = useLocation();
  return (
    <nav
      data-bottom-nav=""
      aria-label={NAV_LABEL}
      className="fixed inset-x-0 bottom-0 z-30 bg-card px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-raised lg:hidden"
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-current={isCurrentDestination(item, pathname, items) ? 'page' : undefined}
              className={cn(
                'group flex flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold',
                'text-muted-foreground transition-colors motion-fast',
                'aria-[current=page]:font-bold aria-[current=page]:text-foreground',
                isRoomy ? 'min-h-14 text-sm' : 'min-h-12',
              )}
            >
              {/* The pill marks the current destination by shape: never by colour alone. */}
              <span
                className={cn(
                  'grid h-7 w-14 place-items-center rounded-full transition-colors motion-fast',
                  CURRENT_TINT,
                  CURRENT_ICON,
                  DRIVER_CURRENT_BLOCK,
                  DRIVER_CURRENT_GLYPH,
                )}
              >
                <item.icon aria-hidden="true" className="size-6" strokeWidth={ICON_STROKE} />
              </span>
              {item.label}
            </Link>
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
              end={isExactDestination(to, items)}
              className={cn(
                'group flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-semibold',
                'text-muted-foreground transition-colors motion-fast hover:bg-muted hover:text-foreground',
                'aria-[current=page]:bg-primary-soft aria-[current=page]:font-bold aria-[current=page]:text-foreground',
                'in-data-[ambient=driver]:aria-[current=page]:bg-foreground in-data-[ambient=driver]:aria-[current=page]:text-background',
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn('size-5', CURRENT_ICON, DRIVER_CURRENT_GLYPH)}
                strokeWidth={ICON_STROKE}
              />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
