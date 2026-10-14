import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { Button } from '@/components/common/button';
import { PageTransition } from '@/components/motion/page-transition';
import { useSignOut } from '@/features/account/use-sign-out';

const LOGO_PX = 30;

/**
 * Frame of the pending step (accept the terms). No navigation: the only ways out are finishing
 * the step or signing out.
 */
export function GateShell() {
  const { signOut, isSigningOut } = useSignOut();
  return (
    <div data-ambient="customer" className="flex flex-1 flex-col overflow-x-clip">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8 lg:py-5">
        <HornillaLogo size={LOGO_PX} />
        <Button variant="quiet" size="sm" loading={isSigningOut} onClick={signOut}>
          Cerrar sesión
        </Button>
      </header>
      <main id="contenido" className="flex flex-1 flex-col">
        <PageTransition className="flex flex-1 flex-col" />
      </main>
    </div>
  );
}
