import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { HELPERS_QUERY_LIMIT, MAX_HELPERS } from '../domain/staff/constants';
import { HelperLimitError, HelperNotFoundError } from '../domain/staff/errors';
import { type Helper, HELPER_SLOT_IDS, sortHelpers } from '../domain/staff/helper';
import { helperConverter } from './converters';
import { guarded } from './errors';
import { db } from './firebase';
import { paths } from './paths';

const helperRef = (d: string, slot: string) => doc(db, paths.helper(d, slot));

/**
 * The helpers of a distributor (PLAN 3.2): people who go with a truck and never sign in. Active
 * first, then by name. Its whole staff reads them (the driver picks one when it opens a shift,
 * phase 5). Cost: one read per helper (one when there is none), plus 1 by the rules.
 */
export function listHelpers(d: string): Promise<Helper[]> {
  return guarded(async () => {
    const all = query(
      collection(db, paths.helpers(d)).withConverter(helperConverter),
      limit(HELPERS_QUERY_LIMIT),
    );
    return sortHelpers((await getDocs(all)).docs.map((helper) => helper.data()));
  });
}

/**
 * Owner only, while the distributor is writable: adds a helper, active, in the first free slot
 * (`h00` … `h29`). `name` comes from `prepareHelperName`. Returns its id. When another tab took
 * that slot meanwhile, the transaction tries the next free one.
 * Throws `HelperLimitError` (30 helpers, switched-off ones included), `PermissionDeniedError`
 * or `OfflineError`.
 * Cost: the list (one read per helper) + 1 read per slot tried (normally one) + 1 write, plus
 * 1 lookup by the rules for the list, 1 per read and 2 for the write.
 */
export async function addHelper(d: string, name: string): Promise<string> {
  const used = new Set((await listHelpers(d)).map((helper) => helper.id));
  const free = HELPER_SLOT_IDS.filter((slot) => !used.has(slot));
  return guarded(() =>
    runTransaction(db, async (tx) => {
      for (const slot of free) {
        if ((await tx.get(helperRef(d, slot))).exists()) continue;
        tx.set(helperRef(d, slot), {
          name,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return slot;
      }
      throw new HelperLimitError(MAX_HELPERS);
    }),
  );
}

/** What an owner may change of a helper. */
export interface HelperPatch {
  /** From `prepareHelperName`. */
  name?: string;
  active?: boolean;
}

/**
 * Owner only, while the distributor is writable: renames a helper or switches it off or back
 * on. Helpers are never deleted: a shift (phase 5) names them by their slot.
 * Throws `HelperNotFoundError`, `PermissionDeniedError` or `OfflineError`.
 * Cost: 1 read + 1 write, plus 1 lookup by the rules for the read and 2 for the write.
 */
export function updateHelper(d: string, helperId: string, patch: HelperPatch): Promise<void> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      if (!(await tx.get(helperRef(d, helperId))).exists()) throw new HelperNotFoundError();
      tx.update(helperRef(d, helperId), { ...patch, updatedAt: serverTimestamp() });
    }),
  );
}
