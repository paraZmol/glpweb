import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  firstFreeAddressSlot,
  type PreparedAddress,
  type PreparedUserProfile,
} from '../domain/tenancy/account-input';
import { MAX_ADDRESSES_PER_USER } from '../domain/tenancy/constants';
import { AddressLimitError } from '../domain/tenancy/errors';
import type { Address, UserProfile } from '../domain/tenancy/types';
import { addressConverter, userProfileConverter } from './converters';
import { guarded } from './errors';
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
 * Creates the profile together with the acceptance of `termsVersion`: the rules refuse a
 * profile without it, so only call this after the person actually accepted the terms.
 * Fails with `PermissionDeniedError` if the profile already exists.
 */
export function createUserProfile(
  uid: string,
  profile: PreparedUserProfile,
  termsVersion: string,
): Promise<void> {
  return guarded(() =>
    setDoc(userRef(uid), {
      displayName: profile.displayName,
      phone: profile.phone,
      ownedDistributorIds: [],
      terms: { version: termsVersion, acceptedAt: serverTimestamp() },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
}

/** Records that the account accepted `termsVersion` now (server time). The profile must exist. */
export function acceptTerms(uid: string, termsVersion: string): Promise<void> {
  return guarded(() =>
    updateDoc(userRef(uid), {
      terms: { version: termsVersion, acceptedAt: serverTimestamp() },
      updatedAt: serverTimestamp(),
    }),
  );
}

export function updateUserProfile(uid: string, profile: PreparedUserProfile): Promise<void> {
  return guarded(() =>
    updateDoc(userRef(uid), {
      displayName: profile.displayName,
      phone: profile.phone,
      updatedAt: serverTimestamp(),
    }),
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
