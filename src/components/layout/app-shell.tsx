import { Link } from 'react-router';
import { BrandTheme } from '@/components/brand/brand-theme';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { PageTransition } from '@/components/motion/page-transition';
import type { AppArea } from '@/domain/auth/access';
import { type Account, useAccount } from '@/features/account/account-context';
import { AREA_HOME } from '@/lib/routes';
import { useIsDesktop } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { BottomNav, SideNav } from './app-nav';
import { type NavItem, navItemsFor } from './nav-items';
import { Workplace } from './workplace';

const LOGO_PX = 28;

// ui-system §13: the platform panel shares the sober, dense ambient of the office.
const AMBIENT: Record<AppArea, 'customer' | 'driver' | 'office'> = {
  customer: 'customer',
  driver: 'driver',
  office: 'office',
  platform: 'office',
};

/** Areas that belong to one distributor: they take its brand colour and show its name. */
function workplaceOf(area: AppArea, { current }: Account) {
  const belongsToDistributor = area === 'office' || area === 'driver';
  return belongsToDistributor && current.status === 'ready' ? current : null;
}

type ChromeProps = {
  area: AppArea;
  items: NavItem[];
  workplace: ReturnType<typeof workplaceOf>;
};

function HomeLogo({ area }: { area: AppArea }) {
  return (
    <Link to={AREA_HOME[area]} className="self-start rounded-md">
      <HornillaLogo size={LOGO_PX} />
    </Link>
  );
}

/** Desktop: side bar of 224 px with the logo, the distributor, the destinations and the name. */
function SideBar({ area, items, workplace, name }: ChromeProps & { name: string }) {
  return (
    <aside className="sticky top-(--top-inset) flex h-[calc(100dvh-var(--top-inset))] w-56 shrink-0 flex-col gap-6 overflow-y-auto bg-card px-3 py-5 shadow-card">
      <div className="px-2">
        <HomeLogo area={area} />
      </div>
      {workplace && (
        <div className="px-2">
          <Workplace current={workplace} />
        </div>
      )}
      <SideNav items={items} />
      <p className="mt-auto truncate px-3 text-[0.8125rem] font-semibold text-muted-foreground">
        {name}
      </p>
    </aside>
  );
}

/** Phone: a top bar that says where you are; the destinations live in the bottom bar. */
function TopBar({ area, workplace }: Omit<ChromeProps, 'items'>) {
  return (
    <header className="flex min-h-14 items-center bg-card px-4 py-2 shadow-card">
      {workplace ? <Workplace current={workplace} compact /> : <HomeLogo area={area} />}
    </header>
  );
}

/**
 * Frame of every signed-in area (PLAN 2.4): bottom bar on a phone, side bar from `lg:` up, the
 * ambient of the area in `data-ambient`, and the distributor's colour where the area is hers.
 */
export function AppShell({ area }: { area: AppArea }) {
  const account = useAccount();
  const isDesktop = useIsDesktop();
  const workplace = workplaceOf(area, account);
  const items = navItemsFor(area, account);
  const isSober = AMBIENT[area] === 'office';
  const name = account.profile?.displayName ?? account.session.email ?? '';

  return (
    <BrandTheme color={workplace?.distributor.brandColor} className="flex flex-1 flex-col">
      <div
        data-ambient={AMBIENT[area]}
        className={cn('flex flex-1 overflow-x-clip', isSober ? 'bg-surface-soft' : 'bg-background')}
      >
        {isDesktop && <SideBar area={area} items={items} workplace={workplace} name={name} />}
        <div className="flex min-w-0 flex-1 flex-col">
          {!isDesktop && <TopBar area={area} workplace={workplace} />}
          <main
            id="contenido"
            className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-[calc(var(--bottom-nav-height)+2rem)] lg:px-8 lg:pt-10"
          >
            <PageTransition />
          </main>
        </div>
        {!isDesktop && <BottomNav items={items} isRoomy={area === 'driver'} />}
      </div>
    </BrandTheme>
  );
}
