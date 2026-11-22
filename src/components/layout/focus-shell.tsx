import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { ButtonLink } from '@/components/common/button';
import { PageTransition } from '@/components/motion/page-transition';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';

const LOGO_PX = 30;

const LEAVE_LINK = (
  <ButtonLink to={ROUTES.account} variant="quiet" size="sm" className="h-11">
    <X aria-hidden="true" strokeWidth={ICON_STROKE} />
    Salir
  </ButtonLink>
);

/**
 * Frame of a task that is done from start to end (the sign-up of a distributor, an invitation):
 * no navigation to wander off, only the logo and the way out. The account keeps what it had if
 * it leaves. `exit` replaces "Salir" where the way out is another one.
 */
export function FocusShell({ exit = LEAVE_LINK }: { exit?: ReactNode }) {
  return (
    <div data-ambient="customer" className="flex flex-1 flex-col overflow-x-clip">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8 lg:py-5">
        <Link to={ROUTES.appEntry} className="flex min-h-11 items-center rounded-md">
          <HornillaLogo size={LOGO_PX} />
        </Link>
        {exit}
      </header>
      <main id="contenido" className="flex flex-1 flex-col">
        <PageTransition className="flex flex-1 flex-col" />
      </main>
    </div>
  );
}
