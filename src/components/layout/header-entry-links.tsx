import { ButtonLink } from '@/components/common/button';
import { ROUTES } from '@/lib/routes';

/** The two screens whose header link does not depend on who is signed in. */
export function isEntryScreen(pathname: string): boolean {
  return pathname === ROUTES.signIn || pathname === ROUTES.register;
}

/**
 * Right side of the public header for a visitor without a session: one way in, "Ingresar".
 * With Google as the only way in, signing in and creating an account are the same button
 * (PLAN 2.1, §11 2026-10-14), so the two entry screens get no link at all: it could only lead
 * to that same button. It needs nothing from Firebase, so it can be painted before the session
 * is known.
 */
export function HeaderEntryLinks({ pathname }: { pathname: string }) {
  if (isEntryScreen(pathname)) return null;
  return (
    <ButtonLink to={ROUTES.signIn} variant="line" size="sm">
      Ingresar
    </ButtonLink>
  );
}
