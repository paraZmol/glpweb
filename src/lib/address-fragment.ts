/** What `dropAddressFragment` touches: the address bar and the session history entry. */
export type AddressBar = {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>;
  history: Pick<History, 'state' | 'replaceState'>;
};

/**
 * Takes the fragment (`#…`) out of the address bar without a navigation and without touching
 * the state of the history entry the router keeps there. For a secret that came in the
 * fragment (an invitation code, PLAN §11 2026-10-16): once the page holds it in memory, it no
 * longer shows on screen, in a screenshot or in a link copied from the bar.
 */
export function dropAddressFragment(bar: AddressBar = window): void {
  if (bar.location.hash === '') return;
  bar.history.replaceState(bar.history.state, '', bar.location.pathname + bar.location.search);
}
