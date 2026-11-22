import { describe, expect, it, vi } from 'vitest';
import { type AddressBar, dropAddressFragment } from './address-fragment';

function barAt(pathname: string, search: string, hash: string) {
  const replaceState = vi.fn();
  const state = { key: 'router-entry' };
  const bar: AddressBar = {
    location: { pathname, search, hash },
    history: { state, replaceState },
  };
  return { bar, replaceState, state };
}

// PLAN §11 (2026-10-16): /unirme keeps the code in memory, not in the address bar.
describe('dropAddressFragment', () => {
  it('leaves path and query, keeps the state of the entry and drops the fragment', () => {
    const { bar, replaceState, state } = barAt('/unirme', '?x=1', '#d=seed-dist-a&c=Code');

    dropAddressFragment(bar);

    expect(replaceState).toHaveBeenCalledWith(state, '', '/unirme?x=1');
  });

  it('does nothing when there is no fragment', () => {
    const { bar, replaceState } = barAt('/unirme', '', '');

    dropAddressFragment(bar);

    expect(replaceState).not.toHaveBeenCalled();
  });
});
