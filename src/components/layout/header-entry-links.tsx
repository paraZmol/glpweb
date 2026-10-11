import { ButtonLink } from '@/components/common/button';
import { ROUTES } from '@/lib/routes';

/** The two screens whose header link does not depend on who is signed in. */
export function isEntryScreen(pathname: string): boolean {
  return pathname === ROUTES.signIn || pathname === ROUTES.register;
}

/**
 * Right side of the public header for a visitor without a session. Never the link to the screen
 * the visitor is already on: there, only the other one. It needs nothing from Firebase, so it
 * can be painted before the session is known.
 */
export function HeaderEntryLinks({ pathname }: { pathname: string }) {
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
