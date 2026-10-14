import { useLocation } from 'react-router';
import { Bone } from '@/components/common/skeleton';
import { HeaderEntryLinks, isEntryScreen } from './header-entry-links';

/**
 * Holds the place of the header button (40 px pill) while the session is being restored. On the
 * two entry screens there is nothing to wait for and nothing to show: their header has no link
 * (an account that turns out to be signed in is taken away from them), so no pill either.
 */
export function HeaderAccountPlaceholder() {
  const { pathname } = useLocation();
  if (isEntryScreen(pathname)) return <HeaderEntryLinks pathname={pathname} />;
  return <Bone className="h-10 w-24 rounded-full" />;
}
