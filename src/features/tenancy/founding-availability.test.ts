import { describe, expect, it } from 'vitest';
import { memberOf, PROFILE, SESSION, workingAs } from '../../../tests/support/account-fixtures';
import { MAX_DISTRIBUTORS_PER_ACCOUNT } from '../../domain/tenancy/constants';
import type { CurrentDistributor } from './use-current-distributor';
import { foundingAvailabilityOf } from './founding-availability';

const reload = () => {};
const CUSTOMER: CurrentDistributor = { status: 'none', memberships: [], reload };
const owning = (count: number) => ({
  ...PROFILE,
  ownedDistributorIds: Array.from({ length: count }, (_unused, index) => `d-${index}`),
});

function readOnly(current: CurrentDistributor): CurrentDistributor {
  return current.status === 'ready' ? { ...current, isWritable: false } : current;
}

const availability = (profile: typeof PROFILE | null, current: CurrentDistributor) =>
  foundingAvailabilityOf({ uid: SESSION.uid, profile, current });

// PLAN 2.11: the account screen does not offer a sign-up that would be refused.
describe('foundingAvailabilityOf', () => {
  it('offers the sign-up to a customer and to an owner in good standing', () => {
    expect(availability(PROFILE, CUSTOMER)).toBe('available');
    expect(availability(owning(1), workingAs([memberOf('owner')]))).toBe('available');
  });

  it.each([
    [MAX_DISTRIBUTORS_PER_ACCOUNT - 1, 'available'],
    [MAX_DISTRIBUTORS_PER_ACCOUNT, 'limitReached'],
    [MAX_DISTRIBUTORS_PER_ACCOUNT + 1, 'limitReached'],
  ])('with %i founded it is %s', (count, expected) => {
    expect(availability(owning(count), CUSTOMER)).toBe(expected);
  });

  it('is blocked for the founder of a read-only distributor', () => {
    const suspended = readOnly(workingAs([memberOf('owner')], { status: 'suspended' }));

    expect(availability(owning(1), suspended)).toBe('blocked');
  });

  it('does not block whoever works at a read-only distributor founded by somebody else', () => {
    const elsewhere = readOnly(
      workingAs([memberOf('dispatcher')], { status: 'suspended', ownerUid: 'u-otra' }),
    );

    expect(availability(PROFILE, elsewhere)).toBe('available');
  });

  it('says the cap first when both apply', () => {
    const suspended = readOnly(workingAs([memberOf('owner')], { status: 'suspended' }));

    expect(availability(owning(MAX_DISTRIBUTORS_PER_ACCOUNT), suspended)).toBe('limitReached');
  });

  it.each([
    ['still loading', { status: 'loading' } as const],
    ['without a profile yet', CUSTOMER],
  ])('offers it while the account is %s: the founding has the last word', (_case, current) => {
    expect(availability(null, current)).toBe('available');
  });
});
