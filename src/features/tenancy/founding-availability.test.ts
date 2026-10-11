import { describe, expect, it } from 'vitest';
import { memberOf, PROFILE, SESSION, workingAs } from '../../../tests/support/account-fixtures';
import { MAX_DISTRIBUTORS_PER_ACCOUNT } from '../../domain/tenancy/constants';
import type { CurrentDistributor } from './use-current-distributor';
import { knownFoundingAvailability, unseenOwnedIds } from './founding-availability';

const reload = () => {};
const CUSTOMER: CurrentDistributor = { status: 'none', memberships: [], reload };
const owning = (...ids: string[]) => ({ ...PROFILE, ownedDistributorIds: ids });
const ownedIds = (count: number) => Array.from({ length: count }, (_unused, index) => `d-${index}`);

function readOnly(current: CurrentDistributor): CurrentDistributor {
  return current.status === 'ready' ? { ...current, isWritable: false } : current;
}

const known = (profile: typeof PROFILE | null, current: CurrentDistributor) =>
  knownFoundingAvailability({ uid: SESSION.uid, profile, current });
const unseen = (profile: typeof PROFILE | null, current: CurrentDistributor) =>
  unseenOwnedIds({ uid: SESSION.uid, profile, current });

// PLAN 2.11: the account screen does not offer a sign-up that would be refused.
describe('knownFoundingAvailability', () => {
  it('knows nothing against a customer or an owner in good standing', () => {
    expect(known(PROFILE, CUSTOMER)).toBe('available');
    expect(known(owning('d-norte'), workingAs([memberOf('owner')]))).toBe('available');
  });

  it.each([
    [MAX_DISTRIBUTORS_PER_ACCOUNT - 1, 'available'],
    [MAX_DISTRIBUTORS_PER_ACCOUNT, 'limitReached'],
    [MAX_DISTRIBUTORS_PER_ACCOUNT + 1, 'limitReached'],
  ])('with %i founded it is %s', (count, expected) => {
    expect(known(owning(...ownedIds(count)), CUSTOMER)).toBe(expected);
  });

  it('is blocked for the founder of a read-only distributor', () => {
    const suspended = readOnly(workingAs([memberOf('owner')], { status: 'suspended' }));

    expect(known(owning('d-norte'), suspended)).toBe('blocked');
  });

  it('does not block whoever works at a read-only distributor founded by somebody else', () => {
    const elsewhere = readOnly(
      workingAs([memberOf('dispatcher')], { status: 'suspended', ownerUid: 'u-otra' }),
    );

    expect(known(PROFILE, elsewhere)).toBe('available');
  });

  it('says the cap first when both apply', () => {
    const suspended = readOnly(workingAs([memberOf('owner')], { status: 'suspended' }));

    expect(known(owning(...ownedIds(MAX_DISTRIBUTORS_PER_ACCOUNT)), suspended)).toBe(
      'limitReached',
    );
  });

  it.each([
    ['still loading', { status: 'loading' } as const],
    ['without a profile yet', CUSTOMER],
  ])('knows nothing against an account that is %s', (_case, current) => {
    expect(known(null, current)).toBe('available');
  });
});

// The distributors whose standing has to be read: the ones the panels do not show.
describe('unseenOwnedIds', () => {
  it('is empty for an account that founded nothing', () => {
    expect(unseen(PROFILE, CUSTOMER)).toEqual([]);
  });

  it('leaves out the selected distributor when the account founded it', () => {
    const selected = workingAs([memberOf('owner', 'd-norte')]);

    expect(unseen(owning('d-norte'), selected)).toEqual([]);
    expect(unseen(owning('d-sur', 'd-norte'), selected)).toEqual(['d-sur']);
  });

  it('keeps every founded one when the selected distributor belongs to somebody else', () => {
    const elsewhere = workingAs([memberOf('dispatcher', 'd-ajena')], { ownerUid: 'u-otra' });

    expect(unseen(owning('d-norte'), elsewhere)).toEqual(['d-norte']);
  });

  it('keeps every founded one when the account no longer works at any of them', () => {
    expect(unseen(owning('d-norte', 'd-sur'), CUSTOMER)).toEqual(['d-norte', 'd-sur']);
  });

  it('waits while the selected distributor or the profile are still loading', () => {
    expect(unseen(owning('d-norte'), { status: 'loading' })).toEqual([]);
    expect(unseen(null, CUSTOMER)).toEqual([]);
  });
});
