import { useLocation } from 'react-router';
import { ButtonLink } from '@/components/common/button';
import { useSession } from '@/features/auth/use-session';
import { ROUTES } from '@/lib/routes';
import { HeaderAccountPlaceholder } from './header-account-placeholder';

/**
 * Right side of the public header: where to sign in, or the way into the app when somebody
 * already is. Loaded apart from the first paint because knowing the session needs Firebase.
 */
export default function HeaderAccount() {
  const session = useSession();
  const { pathname } = useLocation();
  if (session.status === 'loading') return <HeaderAccountPlaceholder />;
  if (session.status === 'signedIn') {
    return (
      <ButtonLink to={ROUTES.appEntry} variant="ink" size="sm">
        Ir a mi cuenta
      </ButtonLink>
    );
  }
  // Never the link to the screen the visitor is already on: there, only the other one.
  if (pathname === ROUTES.signIn) {
    return (
      <ButtonLink to={ROUTES.register} variant="line" size="sm">
        Crear cuenta
      </ButtonLink>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {pathname !== ROUTES.register && (
        <ButtonLink
          to={ROUTES.register}
          variant="quiet"
          size="sm"
          className="hidden sm:inline-flex"
        >
          Crear cuenta
        </ButtonLink>
      )}
      <ButtonLink to={ROUTES.signIn} variant="line" size="sm">
        Ingresar
      </ButtonLink>
    </div>
  );
}
