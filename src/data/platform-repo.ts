import {
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  runTransaction,
  serverTimestamp,
  startAfter,
  type Transaction,
  where,
  writeBatch,
} from 'firebase/firestore';
import { PENDING_LISTINGS_LIMIT, PLATFORM_LIST_PAGE_SIZE } from '../domain/tenancy/constants';
import { isOpenToPublic, type PlatformListFilter } from '../domain/tenancy/listing';
import type {
  DistributorControl,
  DistributorPrivateSettings,
  DistributorStatus,
  PublicDistributor,
} from '../domain/tenancy/types';
import {
  controlConverter,
  privateSettingsConverter,
  publicDistributorConverter,
} from './converters';
import { guarded } from './errors';
import { db } from './firebase';
import { collectionGroups, paths } from './paths';

const controlRef = (d: string) => doc(db, paths.distributorControl(d));
const distributorRef = (d: string) => doc(db, paths.distributor(d));

/**
 * Whether the account is a platform admin. Only decides what the app shows: every admin action
 * is checked again by the rules. One billed read.
 */
export function isPlatformAdmin(uid: string): Promise<boolean> {
  return guarded(async () => (await getDoc(doc(db, paths.platformAdmin(uid)))).exists());
}

/**
 * One row of a platform list: the control document of a distributor, which carries copies of
 * its public name and link (`control.distributorName`, `control.slug`; null in a document older
 * than them — show the id instead).
 */
export interface ListedDistributor {
  distributorId: string;
  control: DistributorControl;
}

/** A listing that waits for the review of a platform admin. */
export type PendingListing = ListedDistributor;

type ControlSnapshot = QueryDocumentSnapshot<DistributorControl>;

const controls = () =>
  collectionGroup(db, collectionGroups.private).withConverter(controlConverter);

function listedOf(snapshots: readonly ControlSnapshot[]): ListedDistributor[] {
  return snapshots.flatMap((control) => {
    const distributorId = control.ref.parent.parent?.id;
    return distributorId ? [{ distributorId, control: control.data() }] : [];
  });
}

/**
 * Platform admin only: the listings that are not approved, oldest first (PLAN 2.11). A
 * collection-group query over the control documents, filtered and bounded as the rules demand:
 * it never reads the control document of an approved distributor.
 * Cost: one read per listing found (minimum one), plus one by the rules for the whole query.
 */
export function listPendingListings(options: { limit?: number } = {}): Promise<PendingListing[]> {
  const max = Math.min(options.limit ?? PENDING_LISTINGS_LIMIT, PENDING_LISTINGS_LIMIT);
  return guarded(async () => {
    const waiting = where('listingApproved', '==', false);
    const snapshot = await getDocs(query(controls(), waiting, orderBy('createdAt'), limit(max)));
    return listedOf(snapshot.docs);
  });
}

/** The one filter each list sends; the rules accept these three and no other. */
const LIST_FILTERS = {
  inReview: () => where('listingApproved', '==', false),
  approved: () => where('listingApproved', '==', true),
  suspended: () => where('status', '==', 'suspended'),
} satisfies Record<PlatformListFilter, () => unknown>;

/** Where a page ended. Opaque: hand it back to `listDistributors` to read the next one. */
export interface PageCursor {
  readonly last: unknown;
}

export interface DistributorPage {
  items: ListedDistributor[];
  /** Null on the last page. */
  next: PageCursor | null;
}

export interface DistributorListRequest {
  filter: PlatformListFilter;
  /** `next` of the page before; leave out for the first page. */
  after?: PageCursor | null;
  /** At most `PLATFORM_LIST_PAGE_SIZE`. */
  pageSize?: number;
}

/**
 * Platform admin only: one page of the distributors in a given standing, oldest first — the
 * way to reach one that is already approved or suspended (PLAN 2.11). The name and the link come
 * in the control document, so nothing else is read.
 * Cost: one read per row plus one (the query asks for one row more to know whether a next page
 * exists; minimum one), plus one by the rules. No listener.
 */
export function listDistributors(request: DistributorListRequest): Promise<DistributorPage> {
  const size = Math.min(request.pageSize ?? PLATFORM_LIST_PAGE_SIZE, PLATFORM_LIST_PAGE_SIZE);
  const from = request.after ? [startAfter(request.after.last)] : [];
  return guarded(async () => {
    const page = query(
      controls(),
      LIST_FILTERS[request.filter](),
      orderBy('createdAt'),
      ...from,
      limit(size + 1),
    );
    const found = (await getDocs(page)).docs;
    const shown = found.slice(0, size);
    const last = shown.at(-1);
    return { items: listedOf(shown), next: found.length > size && last ? { last } : null };
  });
}

/** Everything a platform admin looks at to decide on a listing. */
export interface ListingReview {
  distributorId: string;
  /** What visitors will see once it is approved. */
  profile: PublicDistributor;
  control: DistributorControl;
  /** The founder's contact data and what it declared about the business (RUC, record number). */
  settings: DistributorPrivateSettings;
}

/**
 * Platform admin only: the public profile, the control document and the private settings of
 * one distributor. Null when any of the three is missing.
 * Cost: 3 reads, plus up to 4 by the rules (2 for a profile that is not public, 1 each for the
 * other two).
 */
export function getListingReview(d: string): Promise<ListingReview | null> {
  return guarded(async () => {
    const settingsRef = doc(db, paths.distributorPrivateSettings(d));
    const [profile, control, settings] = await Promise.all([
      getDoc(distributorRef(d).withConverter(publicDistributorConverter)),
      getDoc(controlRef(d).withConverter(controlConverter)),
      getDoc(settingsRef.withConverter(privateSettingsConverter)),
    ]);
    const [profileData, controlData, settingsData] = [
      profile.data(),
      control.data(),
      settings.data(),
    ];
    if (!profileData || !controlData || !settingsData) return null;
    return { distributorId: d, profile: profileData, control: controlData, settings: settingsData };
  });
}

/**
 * A control document older than the copies of the public name and link gains them the next time
 * a platform admin decides on it: one more read, only for those documents.
 */
async function missingCopies(tx: Transaction, d: string, control: DistributorControl) {
  if (control.distributorName !== null && control.slug !== null) return {};
  const profile = (
    await tx.get(distributorRef(d).withConverter(publicDistributorConverter))
  ).data();
  return profile ? { distributorName: profile.name, slug: profile.slug } : {};
}

/**
 * Platform admin only: approves a listing (PLAN 2.11). The approval is signed with the admin's
 * own account and server time, the note for the owner and the mark of its correction are
 * removed, and the public flag follows in the same transaction: the distributor becomes visible
 * if it may operate.
 * `now` is the device time: within seconds of the end of a trial the rules may disagree with it
 * and refuse; trying again settles it. Returns false when the distributor does not exist.
 * Cost: 1 read + 2 writes, plus 5 lookups by the rules.
 */
export function approveListing(d: string, adminUid: string, now: Date): Promise<boolean> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      const control = (await tx.get(controlRef(d).withConverter(controlConverter))).data();
      if (!control) return false;
      const acceptingOrders = isOpenToPublic({ ...control, listingApproved: true }, now);
      tx.update(controlRef(d), {
        ...(await missingCopies(tx, d, control)),
        listingApproved: true,
        approvedAt: serverTimestamp(),
        approvedBy: adminUid,
        reviewNote: deleteField(),
        correctedAt: deleteField(),
        updatedAt: serverTimestamp(),
      });
      tx.update(distributorRef(d), { acceptingOrders, updatedAt: serverTimestamp() });
      return true;
    }),
  );
}

/**
 * Platform admin only: sends a listing back to its owner (a refusal, or an approval that is
 * withdrawn), with an optional note the owner reads in its panel. The distributor leaves the
 * search and its public profile closes to visitors in the same batch. `note` must be trimmed
 * and within `REVIEW_NOTE_MAX_LENGTH`; an empty one removes the note. Whatever correction the
 * owner had marked is cleared with it: this is a new question (the rules demand it).
 * Cost: 2 writes, plus 5 lookups by the rules. Fails with `PermissionDeniedError` when the
 * distributor does not exist.
 */
export function returnListingToReview(d: string, note: string): Promise<void> {
  return guarded(() => {
    const batch = writeBatch(db);
    batch.update(controlRef(d), {
      listingApproved: false,
      approvedAt: deleteField(),
      approvedBy: deleteField(),
      reviewNote: note === '' ? deleteField() : note,
      correctedAt: deleteField(),
      updatedAt: serverTimestamp(),
    });
    batch.update(distributorRef(d), { acceptingOrders: false, updatedAt: serverTimestamp() });
    return batch.commit();
  });
}

/**
 * Platform admin only: changes where a distributor stands (suspend, reactivate, mark past due)
 * and, in the same transaction, the public "takes orders" flag that follows from it. The rules
 * refuse a status change that would leave the two documents disagreeing. A distributor that is
 * suspended stops being readable by visitors at once: its name and phones leave with the flag.
 * The approval of its listing, its note and the mark of a correction are not touched. `next`
 * is the new status, or a function that
 * chooses it from the control document read inside the transaction.
 * `now` is the device time: within seconds of the end of a trial the rules may disagree with it
 * and refuse; trying again settles it. Returns false when the distributor does not exist.
 * Cost: 1 read + 2 writes, plus 5 lookups by the rules over 4 documents.
 */
export function setDistributorStatus(
  d: string,
  next: DistributorStatus | ((control: DistributorControl) => DistributorStatus),
  now: Date,
): Promise<boolean> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      const control = (await tx.get(controlRef(d).withConverter(controlConverter))).data();
      if (!control) return false;
      const status = typeof next === 'function' ? next(control) : next;
      const acceptingOrders = isOpenToPublic({ ...control, status }, now);
      const copies = await missingCopies(tx, d, control);
      tx.update(controlRef(d), { ...copies, status, updatedAt: serverTimestamp() });
      tx.update(distributorRef(d), { acceptingOrders, updatedAt: serverTimestamp() });
      return true;
    }),
  );
}
