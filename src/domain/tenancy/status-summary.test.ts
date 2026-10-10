import { describe, expect, it } from 'vitest';
import { planSummaryOf } from './status-summary';

const NOW = new Date('2026-10-10T15:00:00Z');
const inDays = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe('planSummaryOf', () => {
  it.each([
    [30, 30],
    [1, 1],
    [0.01, 1],
    [12.5, 13],
  ])('counts a trial that ends in %d days as %i days left', (days, daysLeft) => {
    const summary = planSummaryOf({ status: 'trial', trialEndsAt: inDays(days) }, NOW);

    expect(summary).toEqual({ kind: 'trial', daysLeft });
  });

  it.each([0, -1, -400])('reports a trial that ended %d days ago as over', (days) => {
    const summary = planSummaryOf({ status: 'trial', trialEndsAt: inDays(days) }, NOW);

    expect(summary).toEqual({ kind: 'trialOver' });
  });

  it.each(['active', 'pastDue', 'suspended'] as const)(
    'ignores the trial date once the status is %s',
    (status) => {
      expect(planSummaryOf({ status, trialEndsAt: inDays(10) }, NOW)).toEqual({ kind: status });
    },
  );
});
