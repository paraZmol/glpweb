import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { ROUTES } from '@/lib/routes';
import { HeaderAccountPlaceholder } from './header-account-placeholder';
import { PublicMenu } from './public-menu';
import { isCurrentLink, PUBLIC_NAV } from './public-nav';

const HeaderAccount = lazy(() => import('./header-account'));

const LOGO_PX = 30;

/** Whether the page has scrolled under the sticky header, to give it its background. */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return scrolled;
}

function DesktopNav() {
  const { pathname, hash } = useLocation();
  return (
    <nav aria-label="Menú principal" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {PUBLIC_NAV.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              aria-current={isCurrentLink(link.to, pathname, hash) ? 'page' : undefined}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-[0.9375rem] font-semibold underline-offset-4 hover:underline aria-[current=page]:text-primary-text aria-[current=page]:underline xl:px-4"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Sticky header of the public pages (PLAN §11, 2026-10-16): logo, the menu (a bar on desktop, a
 * button with a panel on the phone) and "Ingresar". It takes a background once the page scrolls.
 */
export function PublicHeader() {
  const scrolled = useScrolled();
  return (
    <header
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-40 transition-[background-color,box-shadow] motion-instant data-scrolled:bg-background/95 data-scrolled:shadow-card data-scrolled:backdrop-blur"
    >
      <div className="relative mx-auto flex h-17 w-full max-lg:bg-background max-w-7xl items-center justify-between gap-4 px-4 lg:h-20 lg:px-8">
        <Link to={ROUTES.home} className="rounded-md" aria-label="Hornilla, inicio">
          <HornillaLogo size={LOGO_PX} />
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-1">
          <Suspense fallback={<HeaderAccountPlaceholder />}>
            <HeaderAccount />
          </Suspense>
          <PublicMenu />
        </div>
      </div>
    </header>
  );
}
