import { useLocation } from 'react-router';
import { Bone } from '@/components/common/skeleton';
import { HeaderEntryLinks, isEntryScreen } from './header-entry-links';

/**
 * Holds the place of the header button (40 px pill) while the session is being restored. On the
 * sign-in and registration screens there is nothing to wait for: an account that turns out to be
 * signed in is taken away from them, so the link a visitor needs is shown at once instead of a
 * pill that stays empty for as long as the session takes.
 */
export function HeaderAccountPlaceholder() {
  const { pathname } = useLocation();
  if (isEntryScreen(pathname)) return <HeaderEntryLinks pathname={pathname} />;
  return <Bone className="h-10 w-24 rounded-full" />;
}
