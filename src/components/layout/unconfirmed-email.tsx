import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { Button } from '@/components/common/button';
import { ErrorState } from '@/components/common/state-views';
import { TextLink } from '@/components/common/text-link';
import { useSignOut } from '@/features/account/use-sign-out';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

const LOGO_PX = 30;

/**
 * What a session without a confirmed e-mail gets instead of any screen with a session
 * (PLAN 2.1). Sign-in is with Google only, and Google always hands over a confirmed address,
 * so nobody should ever land here; if somebody does, nothing can be stored for that session
 * (the rules refuse it) and there is no step to complete: only to sign out and come in again.
 */
export function UnconfirmedEmail() {
  usePageTitle('No pudimos confirmar tu correo');
  const { signOut, isSigningOut } = useSignOut();
  return (
    <div data-ambient="customer" className="flex flex-1 flex-col overflow-x-clip">
      <header className="mx-auto flex w-full max-w-7xl items-center px-4 py-3 lg:px-8 lg:py-5">
        <HornillaLogo size={LOGO_PX} />
      </header>
      <main id="contenido" className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <ErrorState
          title="No pudimos confirmar tu correo con Google."
          titleLevel={1}
          description={
            <>
              Cierra sesión e inténtalo de nuevo. Si se repite, o si quieres que eliminemos esta
              cuenta, escríbenos desde <TextLink to={ROUTES.contact}>Contacto y reclamos</TextLink>.
            </>
          }
          secondaryAction={
            <Button variant="ink" loading={isSigningOut} onClick={signOut}>
              Cerrar sesión
            </Button>
          }
        />
      </main>
    </div>
  );
}
