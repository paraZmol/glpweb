import { describe, expect, it } from 'vitest';
import { TRIAL_DAYS } from './constants';
import { isSuspendedByPlatform, isWritable, trialDaysLeft, trialEndFrom } from './status';
import { DISTRIBUTOR_STATUSES } from './types';

const NOW = new Date('2026-03-10T15:00:00Z');
const FUTURE = new Date('2026-03-20T15:00:00Z');
const PAST = new Date('2026-03-01T15:00:00Z');

describe('isWritable', () => {
  it.each([
    ['active', FUTURE, true],
    ['active', PAST, true],
    ['trial', FUTURE, true],
    ['trial', PAST, false],
    ['trial', NOW, false],
    ['pastDue', FUTURE, false],
    ['suspended', FUTURE, false],
  ] as const)('%s with trial ending %o → %s', (status, trialEndsAt, expected) => {
    expect(isWritable({ status, trialEndsAt }, NOW)).toBe(expected);
  });

  it('covers every status', () => {
    const covered = ['active', 'trial', 'pastDue', 'suspended'];
    expect([...DISTRIBUTOR_STATUSES].sort()).toEqual([...covered].sort());
  });
});

describe('isSuspendedByPlatform', () => {
  it.each([
    ['suspended', true],
    ['pastDue', false],
    ['trial', false],
    ['active', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(isSuspendedByPlatform(status)).toBe(expected);
  });
});

describe('trialEndFrom', () => {
  it('adds the trial length in days', () => {
    expect(trialEndFrom(NOW, TRIAL_DAYS).toISOString()).toBe('2026-04-09T15:00:00.000Z');
  });
});

describe('trialDaysLeft', () => {
  it('rounds a partial day up', () => {
    const trialEndsAt = new Date('2026-03-12T16:00:00Z');
    expect(trialDaysLeft({ status: 'trial', trialEndsAt }, NOW)).toBe(3);
  });

  it('is zero once the trial is over', () => {
    expect(trialDaysLeft({ status: 'trial', trialEndsAt: PAST }, NOW)).toBe(0);
    expect(trialDaysLeft({ status: 'trial', trialEndsAt: NOW }, NOW)).toBe(0);
  });

  it('is zero outside a trial', () => {
    expect(trialDaysLeft({ status: 'active', trialEndsAt: FUTURE }, NOW)).toBe(0);
  });
});
