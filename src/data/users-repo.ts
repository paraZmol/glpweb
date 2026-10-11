import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  firstFreeAddressSlot,
  type PreparedAddress,
  type PreparedUserProfile,
} from '../domain/tenancy/account-input';
import type { LegalVersions } from '../domain/legal/versions';
import { MAX_ADDRESSES_PER_USER } from '../domain/tenancy/constants';
import { AddressLimitError, ProfileRequiredError } from '../domain/tenancy/errors';
import type { Address, UserProfile } from '../domain/tenancy/types';
import { addressConverter, userProfileConverter } from './converters';
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

/** The two acceptances as the rules expect them: allowed version, server time. */
function acceptanceFields({ termsVersion, privacyVersion }: LegalVersions) {
  return {
    terms: { version: termsVersion, acceptedAt: serverTimestamp() },
    privacy: { version: privacyVersion, acceptedAt: serverTimestamp() },
  };
}

/**
 * Creates the profile together with the acceptance of the terms and of the privacy policy: the
 * rules refuse a profile without both, so only call this after the person actually accepted
 * them. Fails with `PermissionDeniedError` if the profile already exists, or if the e-mail of
 * the account is not verified yet (PLAN 2.11: nothing is stored before that).
 */
export function createUserProfile(
  uid: string,
  profile: PreparedUserProfile,
  versions: LegalVersions,
): Promise<void> {
  return guarded(() =>
    setDoc(userRef(uid), {
      displayName: profile.displayName,
      phone: profile.phone,
      ownedDistributorIds: [],
      ...acceptanceFields(versions),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
}

/**
 * Records that the account accepted those versions of the terms and of the privacy policy now
 * (server time). The profile must exist.
 */
export function acceptLegalVersions(uid: string, versions: LegalVersions): Promise<void> {
  return guarded(() =>
    updateDoc(userRef(uid), { ...acceptanceFields(versions), updatedAt: serverTimestamp() }),
  );
}

/** How long saving the profile waits for the server before giving up. */
export const PROFILE_SAVE_DEADLINE_MS = 8_000;

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
