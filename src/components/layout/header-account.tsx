import { useLocation } from 'react-router';
import { ButtonLink } from '@/components/common/button';
import { useSession } from '@/features/auth/use-session';
import { ROUTES } from '@/lib/routes';
import { HeaderAccountPlaceholder } from './header-account-placeholder';
import { HeaderEntryLinks } from './header-entry-links';

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
  return <HeaderEntryLinks pathname={pathname} />;
}
