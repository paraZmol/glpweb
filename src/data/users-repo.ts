import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  firstFreeAddressSlot,
  type PreparedAddress,
  type PreparedUserProfile,
} from '../domain/tenancy/account-input';
import {
  ACCEPTED_TEXTS,
  type AcceptanceEntry,
  type AcceptedText,
  acceptanceEntryId,
  type LegalVersions,
  MAX_ACCEPTANCE_ENTRIES,
  textsToAccept,
  versionOfText,
} from '../domain/legal/versions';
import { MAX_ADDRESSES_PER_USER } from '../domain/tenancy/constants';
import { AddressLimitError, ProfileRequiredError } from '../domain/tenancy/errors';
import type { Address, UserProfile } from '../domain/tenancy/types';
import { acceptanceEntryConverter, addressConverter, userProfileConverter } from './converters';
import { guarded, withDeadline } from './errors';
import { db } from './firebase';
import { paths } from './paths';

const userRef = (uid: string) => doc(db, paths.user(uid));
const addressRef = (uid: string, slot: string) => doc(db, paths.userAddress(uid, slot));

export function getUserProfile(uid: string): Promise<UserProfile | null> {
  return guarded(async () => {
    const snapshot = await getDoc(userRef(uid).withConverter(userProfileConverter));
    return snapshot.data() ?? null;
  });
}

/**
 * One acceptance is two writes that the rules only take together: the field of the profile and
 * the entry of the history, both with the same version and the server time of the request.
 */
function acceptanceOf(uid: string, text: AcceptedText, versions: LegalVersions) {
  const version = versionOfText(versions, text);
  return {
    profileField: { [text]: { version, acceptedAt: serverTimestamp() } },
    entryRef: doc(db, paths.userAcceptance(uid, acceptanceEntryId(text, version))),
    entry: { document: text, version, acceptedAt: serverTimestamp() },
  };
}

type Acceptance = ReturnType<typeof acceptanceOf>;

const profileFieldsOf = (accepted: Acceptance[]): Record<string, unknown> =>
  Object.assign({}, ...accepted.map((each) => each.profileField));

/**
 * Creates the profile together with the acceptance of the terms and of the privacy policy: the
 * rules refuse a profile without both, so only call this after the person actually accepted
 * them. One batch: the profile and the two entries of the history of acceptances.
 * Fails with `PermissionDeniedError` if the profile already exists, or if the e-mail of the
 * account is not verified yet (PLAN 2.11: nothing is stored before that).
 * Cost: 3 writes, and 4 reads made by the rules.
 */
export function createUserProfile(
  uid: string,
  profile: PreparedUserProfile,
  versions: LegalVersions,
): Promise<void> {
  return guarded(() => {
    const accepted = ACCEPTED_TEXTS.map((text) => acceptanceOf(uid, text, versions));
    const batch = writeBatch(db);
    batch.set(userRef(uid), {
      displayName: profile.displayName,
      phone: profile.phone,
      ownedDistributorIds: [],
      ...profileFieldsOf(accepted),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    for (const { entryRef, entry } of accepted) batch.set(entryRef, entry);
    return batch.commit();
  });
}

/** How long saving the profile waits for the server before giving up. */
export const PROFILE_SAVE_DEADLINE_MS = 8_000;

/**
 * Records that the account accepts those versions of the terms and of the privacy policy now
 * (server time). ONLY THE TEXT THAT IS PENDING IS WRITTEN: one the account already holds in that
 * version keeps its date, and its entry of the history is not touched (the rules would refuse:
 * an accepted version cannot be dated again). Nothing is written when nothing is pending.
 * A transaction, so that it reads what the account holds and writes in one step, and so that it
 * is never left queued without a connection: past `deadlineMs` it throws `OfflineError`.
 * Throws `ProfileRequiredError` when the account has no profile.
 * Cost: 1 read, then 2 writes and 2 reads made by the rules for each pending text.
 */
export function acceptLegalVersions(
  uid: string,
  versions: LegalVersions,
  deadlineMs: number = PROFILE_SAVE_DEADLINE_MS,
): Promise<void> {
  return guarded(() =>
    withDeadline(deadlineMs, (hasExpired) =>
      runTransaction(db, async (tx) => {
        const current = await tx.get(userRef(uid).withConverter(userProfileConverter));
        const held = current.data();
        if (!held) throw new ProfileRequiredError();
        if (hasExpired()) throw new Error('The acceptance was abandoned: its deadline passed');
        const pending = textsToAccept(held, versions).map((text) =>
          acceptanceOf(uid, text, versions),
        );
        if (pending.length === 0) return;
        tx.update(userRef(uid), { ...profileFieldsOf(pending), updatedAt: serverTimestamp() });
        for (const { entryRef, entry } of pending) tx.set(entryRef, entry);
      }),
    ),
  );
}

/**
 * The history of acceptances of the account, newest first: every version of the terms and of
 * the privacy policy it accepted, with the server time of each. Readable by the account itself
 * and by a platform admin. Cost: 1 read per entry (2 for an account on its first versions).
 */
export function listLegalAcceptances(uid: string): Promise<AcceptanceEntry[]> {
  return guarded(async () => {
    const all = collection(db, paths.userAcceptances(uid)).withConverter(acceptanceEntryConverter);
    const newestFirst = query(all, orderBy('acceptedAt', 'desc'), limit(MAX_ACCEPTANCE_ENTRIES));
    return (await getDocs(newestFirst)).docs.map((entry) => entry.data());
  });
}

/**
 * Saves name and phone, and only resolves once the server has them. It goes through a
 * transaction on purpose: a plain write made while the connection is away is queued by the SDK
 * and sent whenever the connection returns, while the screen waits without an answer. A
 * transaction is never queued. If the server does not answer within `deadlineMs` it throws
 * `OfflineError` and nothing is left waiting to be sent: an attempt that reaches the server
 * after the deadline stops before writing.
 * Throws `ProfileRequiredError` when the account has no profile. Cost: 1 read + 1 write.
 */
export function updateUserProfile(
  uid: string,
  profile: PreparedUserProfile,
  deadlineMs: number = PROFILE_SAVE_DEADLINE_MS,
): Promise<void> {
  return guarded(() =>
    withDeadline(deadlineMs, (hasExpired) =>
      runTransaction(db, async (tx) => {
        const current = await tx.get(userRef(uid));
        if (!current.exists()) throw new ProfileRequiredError();
        if (hasExpired()) throw new Error('The save was abandoned: its deadline passed');
        tx.update(userRef(uid), {
          displayName: profile.displayName,
          phone: profile.phone,
          updatedAt: serverTimestamp(),
        });
      }),
    ),
  );
}

export function listAddresses(uid: string): Promise<Address[]> {
  return guarded(async () => {
    const all = collection(db, paths.userAddresses(uid)).withConverter(addressConverter);
    const snapshot = await getDocs(query(all, limit(MAX_ADDRESSES_PER_USER)));
    return snapshot.docs.map((address) => address.data());
  });
}

/**
 * Saves a new address in the first free slot and returns its id. Two tabs racing for the same
 * slot cannot overwrite each other: the second write is an update with a new `createdAt`, which
 * the rules refuse.
 */
export async function addAddress(uid: string, address: PreparedAddress): Promise<string> {
  const used = (await listAddresses(uid)).map((existing) => existing.id);
  const slot = firstFreeAddressSlot(used);
  if (slot === null) throw new AddressLimitError(MAX_ADDRESSES_PER_USER);
  await guarded(() =>
    setDoc(addressRef(uid, slot), {
      ...address,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  return slot;
}

export function updateAddress(uid: string, slot: string, address: PreparedAddress): Promise<void> {
  return guarded(() =>
    updateDoc(addressRef(uid, slot), { ...address, updatedAt: serverTimestamp() }),
  );
}

export function deleteAddress(uid: string, slot: string): Promise<void> {
  return guarded(() => deleteDoc(addressRef(uid, slot)));
}
