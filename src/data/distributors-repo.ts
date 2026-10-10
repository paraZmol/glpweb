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
} from 'firebase/firestore';
import {
  DEFAULT_CURRENCY,
  DEFAULT_MAX_CYLINDERS_PER_ORDER,
  DEFAULT_SCHEDULE,
  DISTRIBUTOR_SEARCH_LIMIT,
  MAX_DISTRIBUTORS_PER_ACCOUNT,
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
import {
  type Distributor,
  type DistributorPrivateSettings,
  type Member,
  VISIBLE_DISTRIBUTOR_STATUSES,
} from '../domain/tenancy/types';
import {
  distributorConverter,
  memberConverter,
  privateSettingsConverter,
  userProfileConverter,
} from './converters';
import { guarded, toDataError } from './errors';
import { db } from './firebase';
import { collectionGroups, paths } from './paths';

const distributorRef = (d: string) => doc(db, paths.distributor(d));
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
}

function publicDocument({ founder, distributor, now }: FoundingRequest) {
  return {
    name: distributor.name,
    slug: distributor.slug,
    ownerUid: founder.uid,
    contactPhone: distributor.contactPhone,
    whatsapp: distributor.whatsapp,
    addressLine: distributor.addressLine,
    plant: { lat: distributor.plant.lat, lng: distributor.plant.lng },
    coverageRadiusKm: distributor.coverageRadiusKm,
    brandColor: distributor.brandColor,
    status: 'trial',
    trialEndsAt: Timestamp.fromDate(trialEndFrom(now, TRIAL_DAYS)),
    schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
    maxCylindersPerOrder: DEFAULT_MAX_CYLINDERS_PER_ORDER,
    brands: [],
    priceFromCents: null,
    currency: DEFAULT_CURRENCY,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Reads first (slug, then founder profile), then the five writes the rules check as one. */
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
  tx.set(slugRef(distributor.slug), { distributorId: id, createdAt: serverTimestamp() });
  tx.set(doc(db, paths.member(id, founder.uid)), {
    uid: founder.uid,
    distributorId: id,
    role: 'owner',
    active: true,
    displayName: distributor.ownerName,
    ...stamps,
  });
  tx.set(doc(db, paths.distributorPrivateSettings(id)), {
    ownerUid: founder.uid,
    ownerName: distributor.ownerName,
    ownerPhone: distributor.ownerPhone,
    ownerEmail: founder.email,
    plan: 'trial',
    ...stamps,
  });
  tx.update(userRef, { ownedDistributorIds: arrayUnion(id), updatedAt: serverTimestamp() });
}

async function slugExists(slug: string): Promise<boolean> {
  return (await getDoc(slugRef(slug))).exists();
}

/**
 * Founds a distributor (PLAN 2.2): public profile, slug, owner member, private settings and the
 * founder's own list, atomically. Returns the new distributor id.
 * Throws `SlugTakenError`, `ProfileRequiredError`, `DistributorLimitError`, or
 * `PermissionDeniedError` when the rules refuse it (e-mail not verified, invalid data, a device
 * clock far from real time).
 * Cost: 2 reads + 5 writes, plus 8 reads billed by the rules.
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

export function getDistributor(d: string): Promise<Distributor | null> {
  return guarded(async () => {
    const snapshot = await getDoc(distributorRef(d).withConverter(distributorConverter));
    return snapshot.data() ?? null;
  });
}

/** Resolves `/d/{slug}`: slug document, then the distributor. Two reads; null if unknown. */
export function getDistributorBySlug(slug: string): Promise<Distributor | null> {
  return guarded(async () => {
    const target: unknown = (await getDoc(slugRef(slug))).data()?.distributorId;
    return typeof target === 'string' ? getDistributor(target) : null;
  });
}

/**
 * Distributors the search page may show: status `trial` or `active`, bounded. One read per
 * result, no listener. An expired trial still comes back (its status stays `trial`): callers
 * filter with `isWritable` / `findNearbyDistributors`.
 */
export function listVisibleDistributors(options: { limit?: number } = {}): Promise<Distributor[]> {
  const max = Math.min(options.limit ?? DISTRIBUTOR_SEARCH_LIMIT, DISTRIBUTOR_SEARCH_LIMIT);
  return guarded(async () => {
    const all = collection(db, paths.distributors()).withConverter(distributorConverter);
    const visible = where('status', 'in', [...VISIBLE_DISTRIBUTOR_STATUSES]);
    const snapshot = await getDocs(query(all, visible, limit(max)));
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

/** Owner edit of the public profile. `patch` must come from `prepareProfilePatch`. */
export function updateDistributorProfile(d: string, patch: DistributorProfilePatch): Promise<void> {
  const document = { ...profileDocument(patch), updatedAt: serverTimestamp() };
  return guarded(() => updateDoc(distributorRef(d), document));
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
 * per membership, minimum one.
 */
export function listMyMemberships(uid: string): Promise<Member[]> {
  return guarded(async () => {
    const members = collectionGroup(db, collectionGroups.members).withConverter(memberConverter);
    const mine = query(members, where('uid', '==', uid), limit(MEMBERSHIPS_QUERY_LIMIT));
    return (await getDocs(mine)).docs.map((member) => member.data());
  });
}
