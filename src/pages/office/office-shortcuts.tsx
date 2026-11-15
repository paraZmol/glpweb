import { BadgePercent, ChevronRight, type LucideIcon, Truck } from 'lucide-react';
import { Link } from 'react-router';
import { Panel } from '@/components/layout/page-header';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';

type Shortcut = { to: string; label: string; detail: string; icon: LucideIcon };

// On a phone these live as tabs inside "Catálogo" and "Planta": the Monitor names them too.
const SHORTCUTS: Shortcut[] = [
  {
    to: ROUTES.officePromotions,
    label: 'Promociones',
    detail: 'Rebajas con fecha de cierre',
    icon: BadgePercent,
  },
  {
    to: ROUTES.officeVehicles,
    label: 'Vehículos',
    detail: 'Cuántos balones lleva cada uno',
    icon: Truck,
  },
];

/**
 * Phone only: the two screens the bottom bar keeps one tap deeper, a tap away from the Monitor.
 * The side bar of a desktop lists every screen, so there it is not shown.
 */
export function OfficeShortcuts() {
  return (
    <Panel dense className="lg:hidden">
      <h2 className="text-lg font-bold">Atajos</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        {SHORTCUTS.map(({ to, label, detail, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="press flex min-h-16 items-center gap-3 rounded-lg bg-muted px-3.5 py-3 motion-instant"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
                <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading font-bold">{label}</span>
                <span className="block text-sm text-muted-foreground">{detail}</span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
                strokeWidth={ICON_STROKE}
              />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
