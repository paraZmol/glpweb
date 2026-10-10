import { X } from 'lucide-react';
import { Link } from 'react-router';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { ButtonLink } from '@/components/common/button';
import { PageTransition } from '@/components/motion/page-transition';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';

const LOGO_PX = 30;

/**
 * Frame of a task that is done from start to end (the sign-up of a distributor): no navigation
 * to wander off, only the logo and the way out. The account keeps what it had if it leaves.
 */
export function FocusShell() {
  return (
    <div data-ambient="customer" className="flex flex-1 flex-col overflow-x-clip">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8 lg:py-5">
        <Link to={ROUTES.appEntry} className="rounded-md">
          <HornillaLogo size={LOGO_PX} />
        </Link>
        <ButtonLink to={ROUTES.account} variant="quiet" size="sm">
          <X aria-hidden="true" strokeWidth={ICON_STROKE} />
          Salir
        </ButtonLink>
      </header>
      <main id="contenido" className="flex flex-1 flex-col">
        <PageTransition className="flex flex-1 flex-col" />
      </main>
    </div>
  );
}
