import {
  arrayUnion,
  collection,
  collectionGroup,
  deleteField,
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
  FoundingBlockedError,
  PermissionDeniedError,
  ProfileRequiredError,
  SlugTakenError,
} from '../domain/tenancy/errors';
import {
  answersReviewNote,
  hasReadOnlyDistributor,
  touchesIdentity,
} from '../domain/tenancy/listing';
import { trialEndFrom } from '../domain/tenancy/status';
import type { BusinessVerification } from '../domain/tenancy/verification-input';
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

/**
 * What anyone may read once the listing is approved: nothing about the plan, the trial or the
 * founder (PLAN 2.9). It is born unlisted: `acceptingOrders` stays false until a platform admin
 * approves it (PLAN 2.11).
 */
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
    acceptingOrders: false,
    schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
    maxCylindersPerOrder: DEFAULT_MAX_CYLINDERS_PER_ORDER,
    brands: [],
    priceFromCents: null,
    currency: DEFAULT_CURRENCY,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** The control documents of the distributors the founder already owns (one read each). */
async function ownedControls(tx: Transaction, ownedIds: readonly string[]) {
  const snapshots = await Promise.all(
    ownedIds.map((id) => tx.get(controlRef(id).withConverter(controlConverter))),
  );
  return snapshots.flatMap((snapshot) => snapshot.data() ?? []);
}

/**
 * Reads first (slug, founder profile, then the control document of each distributor it already
 * owns), then the six writes the rules check as one.
 */
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
  const owned = await ownedControls(tx, profile.ownedDistributorIds);
  if (hasReadOnlyDistributor(owned, request.now)) throw new FoundingBlockedError();

  const stamps = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  tx.set(distributorRef(id), publicDocument(request));
  tx.set(controlRef(id), {
    ownerUid: founder.uid,
    status: 'trial',
    trialEndsAt: Timestamp.fromDate(trialEndFrom(request.now, TRIAL_DAYS)),
    listingApproved: false,
    // Copies for the platform lists; the rules compare them with the public profile.
    distributorName: distributor.name,
    slug: distributor.slug,
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
    taxId: distributor.taxId,
    legalName: distributor.legalName,
    hydrocarbonsRegistry: distributor.hydrocarbonsRegistry,
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
 * Why the rules refused a founding the transaction had found acceptable: another request of the
 * same moment got there first. Two races are possible and each has its own answer (2 reads):
 * the link was taken by somebody else, or another tab of this account founded the distributor
 * that filled its cap. Anything else stays a plain refusal.
 */
async function explainRefusal({ founder, distributor }: FoundingRequest): Promise<Error | null> {
  if (await slugExists(distributor.slug)) return new SlugTakenError(distributor.slug);
  const userRef = doc(db, paths.user(founder.uid)).withConverter(userProfileConverter);
  const owned = (await getDoc(userRef)).data()?.ownedDistributorIds ?? [];
  if (owned.length >= MAX_DISTRIBUTORS_PER_ACCOUNT) {
    return new DistributorLimitError(MAX_DISTRIBUTORS_PER_ACCOUNT);
  }
  return null;
}

/**
 * Founds a distributor (PLAN 2.2): public profile, control document, slug, owner member, private
 * settings and the founder's own list, atomically. Returns the new distributor id. The id is
 * the one the SDK generates: the rules refuse any other shape (PLAN 2.11).
 * The distributor is born unlisted and waiting for the review of a platform admin.
 * Throws `SlugTakenError`, `ProfileRequiredError`, `DistributorLimitError` (also when another
 * tab of the same account reached the cap at the same moment), `FoundingBlockedError`, or
 * `PermissionDeniedError` when the rules refuse it (e-mail not verified, invalid data, a device
 * clock far from real time).
 * Cost: 2 reads + 1 per distributor already owned + 6 writes, plus up to 14 lookups by the
 * rules over the documents of the batch.
 */
export async function createDistributor(request: FoundingRequest): Promise<string> {
  const id = doc(collection(db, paths.distributors())).id;
  try {
    await runTransaction(db, (tx) => foundInTransaction(tx, id, request));
    return id;
  } catch (error) {
    const translated = toDataError(error);
    if (!(translated instanceof PermissionDeniedError)) throw translated;
    // Losing a race surfaces as a refused write: say what really happened.
    throw (await explainRefusal(request).catch(() => null)) ?? translated;
  }
}

/** One read. For live feedback in the sign-up form; the transaction decides in the end. */
export function isSlugAvailable(slug: string): Promise<boolean> {
  return guarded(async () => !(await slugExists(slug)));
}

/**
 * The public profile. Anyone may read it while the distributor takes orders; one that does not
 * (waiting for its review, suspended, trial over) is readable only by its staff and by platform
 * admins, and throws `PermissionDeniedError` for everybody else (PLAN 2.11).
 * One read (plus one by the rules for the staff of an unlisted one); null if it does not exist.
 */
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
  const { ownerUid, status, trialEndsAt, listingApproved, reviewNote, correctedAt } = control;
  return { ...profile, ownerUid, status, trialEndsAt, listingApproved, reviewNote, correctedAt };
}

/**
 * The control document of each distributor an account founded, in the same order, to know
 * whether it may found another one (PLAN 2.11). Null for one that cannot be read (it lost its
 * control document): the founding is refused for it too. Only the founder may ask for its own.
 * Cost: one read per id, none by the rules.
 */
export function getOwnedControls(
  ownedIds: readonly string[],
): Promise<(DistributorControl | null)[]> {
  const read = async (d: string) => {
    try {
      return (await getDoc(controlRef(d).withConverter(controlConverter))).data() ?? null;
    } catch (error) {
      if (toDataError(error) instanceof PermissionDeniedError) return null;
      throw error;
    }
  };
  return guarded(() => Promise.all(ownedIds.map(read)));
}

/**
 * Resolves `/d/{slug}`: slug document, then the distributor. Two reads. Null when no distributor
 * has that link AND when the one that has it is not open to the public (not approved yet,
 * suspended, trial over): a visitor cannot tell the two apart, and learns neither its name nor
 * its phones (PLAN 2.11). Its own staff and platform admins still get it.
 */
export async function getDistributorBySlug(slug: string): Promise<PublicDistributor | null> {
  const link = await guarded(() => getDoc(slugRef(slug)));
  const id: unknown = link.data()?.distributorId;
  if (typeof id !== 'string') return null;
  try {
    return await getDistributor(id);
  } catch (error) {
    if (error instanceof PermissionDeniedError) return null;
    throw error;
  }
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

/** What an owner writes in the control document when its edit answers a note (PLAN 2.11). */
const correctionMark = () => ({ correctedAt: serverTimestamp(), updatedAt: serverTimestamp() });

interface ProfileEdit {
  d: string;
  /** The public document to write, already built. */
  document: Record<string, unknown>;
  /** The edit touches the name or a phone. */
  isBackInReview: boolean;
  /** The listing waits with a note of the platform: the edit is an answer to it. */
  answersNote: boolean;
}

/** The part of an edit that lands in the control document; null when nothing does. */
function controlChangeOf({ document, isBackInReview, answersNote }: ProfileEdit) {
  if (!isBackInReview && !answersNote) return null;
  const backToReview = {
    listingApproved: false,
    approvedAt: deleteField(),
    approvedBy: deleteField(),
  };
  return {
    ...(isBackInReview ? backToReview : {}),
    // The control document keeps a copy of the name for the platform lists.
    ...(document.name === undefined ? {} : { distributorName: document.name }),
    ...(answersNote ? correctionMark() : {}),
    updatedAt: serverTimestamp(),
  };
}

/**
 * An edit that reaches more than the public document is one batch (PLAN 2.11). A new name or
 * phone: the edit itself, which also unlists the distributor; the listing back to review in the
 * control document, with its copy of the name; and, for a new name, the copy every member keeps
 * of it (up to the cap of the staff list; anyone beyond it corrects its own copy the next time
 * it opens the panel). An edit that answers a note of the platform: the edit and the correction
 * mark in the control document.
 * Cost: 2 writes, plus one read and one write per member when the name changes. The rules add 3
 * lookups for the profile, 3 for the control document and 2 per member.
 */
async function editWithControl(edit: ProfileEdit, controlChange: Record<string, unknown>) {
  const { d, document, isBackInReview } = edit;
  const batch = writeBatch(db);
  batch.update(
    distributorRef(d),
    isBackInReview ? { ...document, acceptingOrders: false } : document,
  );
  batch.update(controlRef(d), controlChange);
  if (document.name !== undefined) {
    const staff = query(collection(db, paths.members(d)), limit(MEMBERS_QUERY_LIMIT));
    for (const member of (await getDocs(staff)).docs) {
      batch.update(member.ref, { distributorName: document.name, updatedAt: serverTimestamp() });
    }
  }
  await batch.commit();
}

/**
 * Owner edit of the public profile. `patch` must come from `prepareProfilePatch` and carry only
 * the fields that changed: a patch with `name`, `contactPhone` or `whatsapp` sends the listing
 * back to review and takes the distributor out of the search until a platform admin approves it
 * again. Resolves to true in that case.
 * While the listing waits with a note of the platform, any edit is an answer to it: the control
 * document is marked as corrected in the same batch (`listing` becomes `correctionsSent`).
 * Cost: 1 read (the control document, to know whether a note waits; one more by the rules
 * unless the caller is the founder), then one write, or the batch described above.
 */
export async function updateDistributorProfile(
  d: string,
  patch: DistributorProfilePatch,
): Promise<boolean> {
  const document = { ...profileDocument(patch), updatedAt: serverTimestamp() };
  const isBackInReview = touchesIdentity(patch);
  await guarded(async () => {
    const control = (await getDoc(controlRef(d).withConverter(controlConverter))).data();
    const answersNote = control !== undefined && answersReviewNote(control);
    const edit = { d, document, isBackInReview, answersNote };
    const controlChange = controlChangeOf(edit);
    if (controlChange === null) return updateDoc(distributorRef(d), document);
    return editWithControl(edit, controlChange);
  });
  return isBackInReview;
}

/**
 * Writes the public "takes orders" flag. The rules accept it only when it equals what the
 * control document says at that moment (it may operate and its listing is approved), and only
 * from the staff or a platform admin: this is how a trial that ran out stops being listed
 * (nobody else flips the flag when the date passes).
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

/**
 * The founder's contact data and the verification data of the business. The founder and
 * platform admins only: not even a co-owner (PLAN 2.11).
 */
export function getDistributorPrivateSettings(
  d: string,
): Promise<DistributorPrivateSettings | null> {
  return guarded(async () => {
    const ref = doc(db, paths.distributorPrivateSettings(d));
    return (await getDoc(ref.withConverter(privateSettingsConverter))).data() ?? null;
  });
}

/**
 * Founder only, and only while the listing is not approved: corrects the verification data a
 * platform admin sent back. `verification` must come from `prepareBusinessVerification`.
 * When the listing waits with a note, the control document is marked as corrected in the same
 * transaction (server time; the note itself stays for the admin). Resolves to true in that case.
 * It approves nothing: only a platform admin does.
 * Cost: 1 read + 1 or 2 writes, plus 1 lookup by the rules for the settings and 4 for the mark.
 * Not queued without a connection (`OfflineError`).
 */
export function updateVerificationData(
  d: string,
  verification: BusinessVerification,
): Promise<boolean> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      const control = (await tx.get(controlRef(d).withConverter(controlConverter))).data();
      const answersNote = control !== undefined && answersReviewNote(control);
      tx.update(doc(db, paths.distributorPrivateSettings(d)), {
        taxId: verification.taxId,
        legalName: verification.legalName,
        hydrocarbonsRegistry: verification.hydrocarbonsRegistry,
        updatedAt: serverTimestamp(),
      });
      if (answersNote) tx.update(controlRef(d), correctionMark());
      return answersNote;
    }),
  );
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
