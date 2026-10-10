import { doc, getDoc } from 'firebase/firestore';
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
