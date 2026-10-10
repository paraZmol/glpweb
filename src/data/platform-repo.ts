import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { isWritable } from '../domain/tenancy/status';
import type { DistributorStatus } from '../domain/tenancy/types';
import { controlConverter } from './converters';
import { guarded } from './errors';
import { db } from './firebase';
import { paths } from './paths';

/**
 * Whether the account is a platform admin. Only decides what the app shows: every admin action
 * is checked again by the rules. One billed read.
 */
export function isPlatformAdmin(uid: string): Promise<boolean> {
  return guarded(async () => (await getDoc(doc(db, paths.platformAdmin(uid)))).exists());
}

/**
 * Platform admin only: changes where a distributor stands (suspend, reactivate, mark past due)
 * and, in the same transaction, the public "takes orders" flag that follows from it. The rules
 * refuse a status change that would leave the two documents disagreeing.
 * `now` is the device time: within seconds of the end of a trial the rules may disagree with it
 * and refuse; trying again settles it. Returns false when the distributor does not exist.
 * Cost: 1 read + 2 writes, plus 5 lookups by the rules over 4 documents.
 */
export function setDistributorStatus(
  d: string,
  status: DistributorStatus,
  now: Date,
): Promise<boolean> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      const controlRef = doc(db, paths.distributorControl(d));
      const control = (await tx.get(controlRef.withConverter(controlConverter))).data();
      if (!control) return false;
      const acceptingOrders = isWritable({ status, trialEndsAt: control.trialEndsAt }, now);
      tx.update(controlRef, { status, updatedAt: serverTimestamp() });
      tx.update(doc(db, paths.distributor(d)), { acceptingOrders, updatedAt: serverTimestamp() });
      return true;
    }),
  );
}
