import { describe, expect, it } from 'vitest';
import { MAX_DISTRIBUTORS_PER_ACCOUNT } from './constants';
import { foundingAvailabilityOf, type OwnedControl } from './founding-availability';

const NOW = new Date('2026-10-11T12:00:00Z');
const LATER = new Date('2026-10-20T12:00:00Z');
const BEFORE = new Date('2026-10-01T12:00:00Z');

const ACTIVE: OwnedControl = { status: 'active', trialEndsAt: BEFORE };
const ON_TRIAL: OwnedControl = { status: 'trial', trialEndsAt: LATER };
const SUSPENDED: OwnedControl = { status: 'suspended', trialEndsAt: LATER };
const PAST_DUE: OwnedControl = { status: 'pastDue', trialEndsAt: BEFORE };
const TRIAL_OVER: OwnedControl = { status: 'trial', trialEndsAt: BEFORE };

// PLAN 2.11: the answer the founding would give, known before the form is filled.
describe('foundingAvailabilityOf', () => {
  it('is available for an account that founded nothing', () => {
    expect(foundingAvailabilityOf(0, [], NOW)).toBe('available');
  });

  it.each([
    ['an active one', [ACTIVE]],
    ['one on a running trial', [ON_TRIAL]],
    ['two healthy ones', [ACTIVE, ON_TRIAL]],
  ])('is available for the founder of %s', (_case, controls) => {
    expect(foundingAvailabilityOf(controls.length, controls, NOW)).toBe('available');
  });

  it.each([
    ['suspended', [SUSPENDED]],
    ['past due', [PAST_DUE]],
    ['with its trial over', [TRIAL_OVER]],
    ['read-only next to a healthy one', [ACTIVE, SUSPENDED]],
    ['read-only before a healthy one', [TRIAL_OVER, ACTIVE]],
  ])('is blocked while one of them is %s', (_case, controls) => {
    expect(foundingAvailabilityOf(controls.length, controls, NOW)).toBe('blocked');
  });

  it('is blocked when a control document cannot be read: the rules refuse it too', () => {
    expect(foundingAvailabilityOf(2, [ACTIVE, null], NOW)).toBe('blocked');
  });

  it('judges the trial at the moment it is asked', () => {
    const endsNow: OwnedControl = { status: 'trial', trialEndsAt: NOW };

    expect(foundingAvailabilityOf(1, [endsNow], NOW)).toBe('blocked');
    expect(foundingAvailabilityOf(1, [endsNow], new Date(NOW.getTime() - 1))).toBe('available');
  });

  it.each([
    [MAX_DISTRIBUTORS_PER_ACCOUNT - 1, 'available'],
    [MAX_DISTRIBUTORS_PER_ACCOUNT, 'limitReached'],
    [MAX_DISTRIBUTORS_PER_ACCOUNT + 1, 'limitReached'],
  ] as const)('with %i founded and all healthy it is %s', (count, expected) => {
    const controls = Array.from({ length: count }, () => ACTIVE);

    expect(foundingAvailabilityOf(count, controls, NOW)).toBe(expected);
  });

  it('says the cap first when both apply, as the founding does', () => {
    const controls = [SUSPENDED, ACTIVE, ACTIVE];

    expect(foundingAvailabilityOf(MAX_DISTRIBUTORS_PER_ACCOUNT, controls, NOW)).toBe(
      'limitReached',
    );
  });
});
