import {
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Transaction,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_CURRENCY,
  DEFAULT_MAX_CYLINDERS_PER_ORDER,
  DEFAULT_SCHEDULE,
  DISTRIBUTOR_SEARCH_LIMIT,
  MAX_DISTRIBUTORS_PER_ACCOUNT,
  MEMBERS_QUERY_LIMIT,
  MEMBERSHIPS_QUERY_LIMIT,
  TRIAL_DAYS,
} from '../domain/tenancy/constants';
import type { DistributorProfilePatch, NewDistributor } from '../domain/tenancy/distributor-input';
import {
  DistributorLimitError,
  PermissionDeniedError,
  ProfileRequiredError,
  SlugTakenError,
} from '../domain/tenancy/errors';
import { trialEndFrom } from '../domain/tenancy/status';
import type {
  Distributor,
  DistributorControl,
  DistributorPrivateSettings,
  Member,
  PublicDistributor,
} from '../domain/tenancy/types';
import {
  controlConverter,
  memberConverter,
  privateSettingsConverter,
  publicDistributorConverter,
  userProfileConverter,
} from './converters';
import { guarded, toDataError } from './errors';
import { db } from './firebase';
import { collectionGroups, paths } from './paths';

const distributorRef = (d: string) => doc(db, paths.distributor(d));
const controlRef = (d: string) => doc(db, paths.distributorControl(d));
const memberRef = (d: string, uid: string) => doc(db, paths.member(d, uid));
const slugRef = (slug: string) => doc(db, paths.slug(slug));

export interface Founder {
  uid: string;
  /** Must be the verified e-mail of the session: the rules compare it with the ID token. */
  email: string;
}

export interface FoundingRequest {
  founder: Founder;
  distributor: NewDistributor;
  /** Device time; the rules accept the trial end within a window around server time. */
  now: Date;
  /**
   * Version of the terms the founder accepted while also declaring it may represent the
   * business. Both are stored with server time; only pass it after the person really did both.
   */
  termsVersion: string;
}

/** What anyone may read: nothing about the plan, the trial or the founder (PLAN 2.9). */
function publicDocument({ distributor }: FoundingRequest) {
  return {
    name: distributor.name,
    slug: distributor.slug,
    contactPhone: distributor.contactPhone,
    whatsapp: distributor.whatsapp,
    addressLine: distributor.addressLine,
    plant: { lat: distributor.plant.lat, lng: distributor.plant.lng },
    coverageRadiusKm: distributor.coverageRadiusKm,
    brandColor: distributor.brandColor,
    acceptingOrders: true,
    schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
    maxCylindersPerOrder: DEFAULT_MAX_CYLINDERS_PER_ORDER,
    brands: [],
    priceFromCents: null,
    currency: DEFAULT_CURRENCY,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Reads first (slug, then founder profile), then the six writes the rules check as one. */
async function foundInTransaction(tx: Transaction, id: string, request: FoundingRequest) {
  const { founder, distributor } = request;
  const userRef = doc(db, paths.user(founder.uid));
  const takenSlug = await tx.get(slugRef(distributor.slug));
  const profile = (await tx.get(userRef.withConverter(userProfileConverter))).data();
  if (takenSlug.exists()) throw new SlugTakenError(distributor.slug);
  if (!profile) throw new ProfileRequiredError();
  if (profile.ownedDistributorIds.length >= MAX_DISTRIBUTORS_PER_ACCOUNT) {
    throw new DistributorLimitError(MAX_DISTRIBUTORS_PER_ACCOUNT);
  }

  const stamps = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  tx.set(distributorRef(id), publicDocument(request));
  tx.set(controlRef(id), {
    ownerUid: founder.uid,
    status: 'trial',
    trialEndsAt: Timestamp.fromDate(trialEndFrom(request.now, TRIAL_DAYS)),
    ...stamps,
  });
  tx.set(slugRef(distributor.slug), { distributorId: id, createdAt: serverTimestamp() });
  tx.set(memberRef(id, founder.uid), {
    uid: founder.uid,
    distributorId: id,
    role: 'owner',
    active: true,
    displayName: distributor.ownerName,
    distributorName: distributor.name,
    ...stamps,
  });
  tx.set(doc(db, paths.distributorPrivateSettings(id)), {
    ownerUid: founder.uid,
    ownerName: distributor.ownerName,
    ownerPhone: distributor.ownerPhone,
    ownerEmail: founder.email,
    plan: 'trial',
    terms: { version: request.termsVersion, acceptedAt: serverTimestamp() },
    authorityDeclaredAt: serverTimestamp(),
    ...stamps,
  });
  tx.update(userRef, { ownedDistributorIds: arrayUnion(id), updatedAt: serverTimestamp() });
}

async function slugExists(slug: string): Promise<boolean> {
  return (await getDoc(slugRef(slug))).exists();
}

/**
 * Founds a distributor (PLAN 2.2): public profile, control document, slug, owner member, private
 * settings and the founder's own list, atomically. Returns the new distributor id.
 * Throws `SlugTakenError`, `ProfileRequiredError`, `DistributorLimitError`, or
 * `PermissionDeniedError` when the rules refuse it (e-mail not verified, invalid data, a device
 * clock far from real time).
 * Cost: 2 reads + 6 writes, plus 12 lookups by the rules over the 6 documents of the batch.
 */
export async function createDistributor(request: FoundingRequest): Promise<string> {
  const id = doc(collection(db, paths.distributors())).id;
  try {
    await runTransaction(db, (tx) => foundInTransaction(tx, id, request));
    return id;
  } catch (error) {
    const translated = toDataError(error);
    // Losing a race for the slug surfaces as a refused write: say what really happened.
    const lostSlugRace =
      translated instanceof PermissionDeniedError && (await slugExists(request.distributor.slug));
    throw lostSlugRace ? new SlugTakenError(request.distributor.slug) : translated;
  }
}

/** One read. For live feedback in the sign-up form; the transaction decides in the end. */
export function isSlugAvailable(slug: string): Promise<boolean> {
  return guarded(async () => !(await slugExists(slug)));
}

/** The public profile, for anyone. One read; null if unknown. */
export function getDistributor(d: string): Promise<PublicDistributor | null> {
  return guarded(async () => {
    const snapshot = await getDoc(distributorRef(d).withConverter(publicDistributorConverter));
    return snapshot.data() ?? null;
  });
}

/**
 * Where the distributor stands with the platform. Staff of that distributor and platform admins
 * only. One read, plus one by the rules unless the caller is the founder.
 */
export function getDistributorControl(d: string): Promise<DistributorControl | null> {
  return guarded(async () => {
    return (await getDoc(controlRef(d).withConverter(controlConverter))).data() ?? null;
  });
}

/**
 * The distributor as its staff sees it: public profile plus control data, read together.
 * Two reads, plus one by the rules unless the caller is the founder. Null if it does not exist;
 * `PermissionDeniedError` for an account that does not work there.
 */
export async function getStaffDistributor(d: string): Promise<Distributor | null> {
  const [profile, control] = await Promise.all([getDistributor(d), getDistributorControl(d)]);
  if (!profile || !control) return null;
  const { ownerUid, status, trialEndsAt } = control;
  return { ...profile, ownerUid, status, trialEndsAt };
}

/** Resolves `/d/{slug}`: slug document, then the distributor. Two reads; null if unknown. */
export function getDistributorBySlug(slug: string): Promise<PublicDistributor | null> {
  return guarded(async () => {
    const target: unknown = (await getDoc(slugRef(slug))).data()?.distributorId;
    return typeof target === 'string' ? getDistributor(target) : null;
  });
}

/**
 * Distributors the search page may show: those marked as accepting orders, bounded. One read
 * per result, no listener. The flag can lag behind a trial that ran out (see
 * `syncAcceptingOrders`), so one of them may still refuse the order.
 */
export function listVisibleDistributors(
  options: { limit?: number } = {},
): Promise<PublicDistributor[]> {
  const max = Math.min(options.limit ?? DISTRIBUTOR_SEARCH_LIMIT, DISTRIBUTOR_SEARCH_LIMIT);
  return guarded(async () => {
    const all = collection(db, paths.distributors()).withConverter(publicDistributorConverter);
    const listed = where('acceptingOrders', '==', true);
    const snapshot = await getDocs(query(all, listed, limit(max)));
    return snapshot.docs.map((distributor) => distributor.data());
  });
}

/** Nested maps are rebuilt key by key: the rules refuse a map that carries anything extra. */
function profileDocument(patch: DistributorProfilePatch): Record<string, unknown> {
  const document: Record<string, unknown> = { ...patch };
  if (patch.plant) document.plant = { lat: patch.plant.lat, lng: patch.plant.lng };
  if (patch.schedule) {
    const { days, opensAt, closesAt } = patch.schedule;
    document.schedule = { days: [...days], opensAt, closesAt };
  }
  return document;
}

/**
 * A new name goes to the public profile and, in the same batch, to the copy every member keeps
 * of it (up to the cap of the staff list; anyone beyond it corrects its own copy the next time
 * it opens the panel). Costs one read and one write per member.
 */
async function renameDistributor(d: string, document: Record<string, unknown>): Promise<void> {
  const staff = query(collection(db, paths.members(d)), limit(MEMBERS_QUERY_LIMIT));
  const members = await getDocs(staff);
  const batch = writeBatch(db);
  batch.update(distributorRef(d), document);
  for (const member of members.docs) {
    batch.update(member.ref, { distributorName: document.name, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

/** Owner edit of the public profile. `patch` must come from `prepareProfilePatch`. */
export function updateDistributorProfile(d: string, patch: DistributorProfilePatch): Promise<void> {
  const document = { ...profileDocument(patch), updatedAt: serverTimestamp() };
  if (patch.name !== undefined) return guarded(() => renameDistributor(d, document));
  return guarded(() => updateDoc(distributorRef(d), document));
}

/**
 * Writes the public "takes orders" flag. The rules accept it only when it equals what the
 * control document says at that moment, and only from the staff or a platform admin: this is how
 * a trial that ran out stops being listed (nobody else flips the flag when the date passes).
 */
export function syncAcceptingOrders(d: string, acceptingOrders: boolean): Promise<void> {
  return guarded(() =>
    updateDoc(distributorRef(d), { acceptingOrders, updatedAt: serverTimestamp() }),
  );
}

/** Refreshes the copy of the distributor's name in one member document (the caller's own). */
export function syncMemberDistributorName(d: string, uid: string, name: string): Promise<void> {
  return guarded(() =>
    updateDoc(memberRef(d, uid), { distributorName: name, updatedAt: serverTimestamp() }),
  );
}

/** Founder, co-owners and platform admins only. */
export function getDistributorPrivateSettings(
  d: string,
): Promise<DistributorPrivateSettings | null> {
  return guarded(async () => {
    const ref = doc(db, paths.distributorPrivateSettings(d));
    return (await getDoc(ref.withConverter(privateSettingsConverter))).data() ?? null;
  });
}

/**
 * Every distributor the account belongs to, in any role, active or not. Collection-group query
 * on `members` filtered by the account's own uid (the rules allow no other filter): one read
 * per membership, minimum one. Each one carries the name of its distributor.
 */
export function listMyMemberships(uid: string): Promise<Member[]> {
  return guarded(async () => {
    const members = collectionGroup(db, collectionGroups.members).withConverter(memberConverter);
    const mine = query(members, where('uid', '==', uid), limit(MEMBERSHIPS_QUERY_LIMIT));
    return (await getDocs(mine)).docs.map((member) => member.data());
  });
}
