import type { DistributorControl } from './types';

type WritableInput = Pick<DistributorControl, 'status' | 'trialEndsAt'>;

/**
 * A distributor accepts business writes while it is `active`, or on `trial` before the trial
 * ends. `pastDue` and `suspended` are read-only. firebase/firestore.rules repeats this condition
 * (`isWritableData`) over the control document; the rules tests prove both agree. It is also the
 * value the public `acceptingOrders` flag must carry whenever somebody writes it.
 */
export function isWritable(distributor: WritableInput, now: Date): boolean {
  if (distributor.status === 'active') return true;
  if (distributor.status !== 'trial') return false;
  return distributor.trialEndsAt.getTime() > now.getTime();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** End of a trial that starts at `startedAt`. */
export function trialEndFrom(startedAt: Date, trialDays: number): Date {
  return new Date(startedAt.getTime() + trialDays * MS_PER_DAY);
}

/** Whole days of trial left, rounded up; 0 when it is over or the distributor is not on trial. */
export function trialDaysLeft(distributor: WritableInput, now: Date): number {
  if (distributor.status !== 'trial') return 0;
  const remainingMs = distributor.trialEndsAt.getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / MS_PER_DAY);
}
