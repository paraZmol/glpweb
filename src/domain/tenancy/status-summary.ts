import { trialDaysLeft } from './status';
import type { Distributor } from './types';

/**
 * How the plan of a distributor stands today, for the office header. `tone` maps to a system
 * state colour; the words are chosen by the screen.
 */
export type PlanSummary =
  | { kind: 'trial'; daysLeft: number }
  | { kind: 'trialOver' }
  | { kind: 'active' }
  | { kind: 'pastDue' }
  | { kind: 'suspended' };

export function planSummaryOf(
  distributor: Pick<Distributor, 'status' | 'trialEndsAt'>,
  now: Date,
): PlanSummary {
  if (distributor.status !== 'trial') return { kind: distributor.status };
  const daysLeft = trialDaysLeft(distributor, now);
  return daysLeft > 0 ? { kind: 'trial', daysLeft } : { kind: 'trialOver' };
}
