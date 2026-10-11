import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { EMULATOR_HOST, emulatorPorts } from '../../scripts/lane-ports.mjs';
import { PRIVACY_VERSION, TERMS_VERSION } from '../../src/domain/legal/versions';
import { DEFAULT_SCHEDULE, TRIAL_DAYS } from '../../src/domain/tenancy/constants';
import type { DistributorStatus, MemberRole } from '../../src/domain/tenancy/types';

export type Db = ReturnType<RulesTestContext['firestore']>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The mutation run (scripts/mutate-rules.mjs) points these at a deliberately broken copy of the
// rules and at emulator projects of its own, so several copies can be tested side by side.
const RULES_FILE = process.env.RULES_FILE ?? 'firebase/firestore.rules';
const PROJECT_PREFIX = process.env.RULES_PROJECT_PREFIX ?? 'demo-glpweb';

/** Each test file gets its own emulator project so files never see each other's data. */
export function createEnv(suffix: string): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: `${PROJECT_PREFIX}-${suffix}`,
    firestore: {
      rules: readFileSync(RULES_FILE, 'utf8'),
      host: EMULATOR_HOST,
      port: emulatorPorts().firestore,
    },
  });
}

export const emailOf = (uid: string) => `${uid}@example.com`;

export function verified(env: RulesTestEnvironment, uid: string): Db {
  return env.authenticatedContext(uid, { email: emailOf(uid), email_verified: true }).firestore();
}

export function unverified(env: RulesTestEnvironment, uid: string): Db {
  return env.authenticatedContext(uid, { email: emailOf(uid), email_verified: false }).firestore();
}

export function anonymous(env: RulesTestEnvironment): Db {
  return env.unauthenticatedContext().firestore();
}

export const daysFromNow = (days: number) => Timestamp.fromMillis(Date.now() + days * MS_PER_DAY);

// ---------------------------------------------------------------------------------------------
// Valid documents, as a well-behaved client writes them. Tests change one thing at a time.
// ---------------------------------------------------------------------------------------------

/** A copy of `data` without one field, to attack "required" checks. */
export function without(data: Record<string, unknown>, field: string): Record<string, unknown> {
  const { [field]: _dropped, ...rest } = data;
  return rest;
}

export function termsDoc(change: Record<string, unknown> = {}) {
  return { version: TERMS_VERSION, acceptedAt: serverTimestamp(), ...change };
}

export function privacyDoc(change: Record<string, unknown> = {}) {
  return { version: PRIVACY_VERSION, acceptedAt: serverTimestamp(), ...change };
}

export function userDoc(change: Record<string, unknown> = {}) {
  return {
    displayName: 'C. Persona',
    phone: null,
    ownedDistributorIds: [],
    terms: termsDoc(),
    privacy: privacyDoc(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...change,
  };
}

export function addressDoc(change: Record<string, unknown> = {}) {
  return {
    label: 'Casa',
    addressLine: 'Calle Uno 123',
    reference: '',
    location: { lat: -12.0464, lng: -77.0428 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...change,
  };
}

export const DISTRIBUTOR_NAME = 'Gas Demo';

const DISTRIBUTOR_ID_LENGTH = 20;

/**
 * An id with the shape of the ones Firestore generates (20 letters and digits), readable in a
 * failure message: `newDistributorId('New')` is `distNew0000000000000`.
 */
export function newDistributorId(label: string): string {
  return `dist${label}`.padEnd(DISTRIBUTOR_ID_LENGTH, '0');
}

/** The public document as the founding batch writes it: unlisted until it is approved. */
export function distributorDoc(slug: string, change: Record<string, unknown> = {}) {
  return {
    name: DISTRIBUTOR_NAME,
    slug,
    contactPhone: '900000001',
    whatsapp: '900000001',
    addressLine: 'Av. Principal 100',
    plant: { lat: -12.0464, lng: -77.0428 },
    coverageRadiusKm: 5,
    brandColor: '#d9480f',
    acceptingOrders: false,
    schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
    maxCylindersPerOrder: 3,
    brands: [],
    priceFromCents: null,
    currency: 'PEN',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...change,
  };
}

/**
 * The control document as the founding batch writes it: plan state, founder and a listing that
 * waits for its review.
 */
export function controlDoc(ownerUid: string, change: Record<string, unknown> = {}) {
  return {
    ownerUid,
    status: 'trial',
    trialEndsAt: daysFromNow(TRIAL_DAYS),
    listingApproved: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...change,
  };
}

export function slugDoc(distributorId: string, change: Record<string, unknown> = {}) {
  return { distributorId, createdAt: serverTimestamp(), ...change };
}

export function memberDoc(
  distributorId: string,
  uid: string,
  role: MemberRole,
  change: Record<string, unknown> = {},
) {
  return {
    uid,
    distributorId,
    role,
    active: true,
    displayName: 'A. Persona',
    distributorName: DISTRIBUTOR_NAME,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...change,
  };
}

export function privateDoc(ownerUid: string, change: Record<string, unknown> = {}) {
  return {
    ownerUid,
    ownerName: 'A. Persona',
    ownerPhone: '900000002',
    ownerEmail: emailOf(ownerUid),
    plan: 'trial',
    taxId: '20000000001',
    legalName: 'Gas Demo S.A.C.',
    hydrocarbonsRegistry: '00000-074-000000',
    terms: termsDoc(),
    authorityDeclaredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...change,
  };
}

// ---------------------------------------------------------------------------------------------
// The founding batch (PLAN 2.2): distributor + control + slug + owner member + private settings
// + the founder's own list of distributors. Every piece can be replaced or dropped to attack it.
// ---------------------------------------------------------------------------------------------

type Piece = Record<string, unknown> | null;

export interface FoundingOptions {
  d: string;
  uid: string;
  slug: string;
  /** Document id of the slug, when the attack wants it to differ from the distributor's slug. */
  slugId?: string;
  distributor?: Piece;
  control?: Piece;
  slugData?: Piece;
  member?: Piece;
  settings?: Piece;
  /** `false` leaves the founder's profile untouched. */
  userUpdate?: Record<string, unknown> | false;
}

export function foundDistributor(db: Db, options: FoundingOptions): Promise<void> {
  const { d, uid, slug } = options;
  const pieces: [string, Piece][] = [
    [
      `distributors/${d}`,
      options.distributor === undefined ? distributorDoc(slug) : options.distributor,
    ],
    [
      `distributors/${d}/private/control`,
      options.control === undefined ? controlDoc(uid) : options.control,
    ],
    [
      `slugs/${options.slugId ?? slug}`,
      options.slugData === undefined ? slugDoc(d) : options.slugData,
    ],
    [
      `distributors/${d}/members/${uid}`,
      options.member === undefined ? memberDoc(d, uid, 'owner') : options.member,
    ],
    [
      `distributors/${d}/private/settings`,
      options.settings === undefined ? privateDoc(uid) : options.settings,
    ],
  ];
  const batch = writeBatch(db);
  for (const [path, data] of pieces) if (data !== null) batch.set(doc(db, path), data);
  if (options.userUpdate !== false) {
    batch.update(
      doc(db, `users/${uid}`),
      options.userUpdate ?? { ownedDistributorIds: arrayUnion(d), updatedAt: serverTimestamp() },
    );
  }
  return batch.commit();
}

/** What a control document carries when its listing goes back to review. */
export function backToReview(): Record<string, unknown> {
  return {
    listingApproved: false,
    approvedAt: deleteField(),
    approvedBy: deleteField(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * What a well-behaved client sends when an owner changes the name or a phone (PLAN 2.11): the
 * edit, which also unlists the distributor, and the listing back to review, in one batch.
 */
export function editIdentity(db: Db, d: string, change: Record<string, unknown>): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, `distributors/${d}`), {
    ...change,
    acceptingOrders: false,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, `distributors/${d}/private/control`), backToReview());
  return batch.commit();
}

// ---------------------------------------------------------------------------------------------
// Seeded world, written with the rules disabled.
// ---------------------------------------------------------------------------------------------

export interface SeededDistributor {
  d: string;
  slug: string;
  status: DistributorStatus;
  trialEndsAt: Timestamp;
  /** False for a listing that still waits for its review; approved when left out. */
  listingApproved?: boolean;
  /** uid → role. The first owner listed is the founder. */
  members: Record<string, MemberRole>;
}

const PAST = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));

/**
 * A and B are healthy and so is `trial`; `pending` may operate but waits for its review, so it
 * is not listed; the others are approved and read-only for a different reason each.
 * `customer` has a profile and no membership; `admin` is a platform admin.
 */
export const WORLD = {
  a: {
    d: 'dist-a',
    slug: 'gas-demo-a',
    status: 'active',
    trialEndsAt: PAST,
    members: { 'owner-a': 'owner', 'dispatcher-a': 'dispatcher', 'driver-a': 'driver' },
  },
  b: {
    d: 'dist-b',
    slug: 'gas-demo-b',
    status: 'active',
    trialEndsAt: PAST,
    members: { 'owner-b': 'owner', 'dispatcher-b': 'dispatcher', 'driver-b': 'driver' },
  },
  trial: {
    d: 'dist-trial',
    slug: 'gas-demo-trial',
    status: 'trial',
    trialEndsAt: daysFromNow(10),
    members: { 'owner-trial': 'owner' },
  },
  suspended: {
    d: 'dist-suspended',
    slug: 'gas-demo-suspended',
    status: 'suspended',
    trialEndsAt: daysFromNow(10),
    members: { 'owner-suspended': 'owner', 'driver-suspended': 'driver' },
  },
  expired: {
    d: 'dist-expired',
    slug: 'gas-demo-expired',
    status: 'trial',
    trialEndsAt: PAST,
    members: { 'owner-expired': 'owner', 'driver-expired': 'driver' },
  },
  pastDue: {
    d: 'dist-past-due',
    slug: 'gas-demo-past-due',
    status: 'pastDue',
    trialEndsAt: PAST,
    members: { 'owner-past-due': 'owner' },
  },
  pending: {
    d: 'dist-pending',
    slug: 'gas-demo-pending',
    status: 'trial',
    trialEndsAt: daysFromNow(20),
    listingApproved: false,
    members: { 'owner-pending': 'owner', 'driver-pending': 'driver' },
  },
} satisfies Record<string, SeededDistributor>;

export const ADMIN_UID = 'admin';
export const CUSTOMER_UID = 'customer';

const founderOf = (seeded: SeededDistributor) => Object.keys(seeded.members)[0] ?? '';

const isApproved = (seeded: SeededDistributor) => seeded.listingApproved !== false;

/** Same condition as the domain `isOpenToPublic`, at the moment of seeding. */
const takesOrders = (seeded: SeededDistributor) =>
  isApproved(seeded) &&
  (seeded.status === 'active' ||
    (seeded.status === 'trial' && seeded.trialEndsAt.toMillis() > Date.now()));

/** The control document of a seeded distributor: approved by the admin unless it says otherwise. */
export function seededControlDoc(
  ownerUid: string,
  change: Record<string, unknown> = {},
): Record<string, unknown> {
  const at = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
  return controlDoc(ownerUid, {
    listingApproved: true,
    approvedAt: at,
    approvedBy: ADMIN_UID,
    createdAt: at,
    updatedAt: at,
    ...change,
  });
}

export async function seedWorld(env: RulesTestEnvironment): Promise<void> {
  const at = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
  const stamps = { createdAt: at, updatedAt: at };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    for (const seeded of Object.values(WORLD)) {
      const founder = founderOf(seeded);
      const { d, slug, status, trialEndsAt } = seeded;
      batch.set(
        doc(db, `distributors/${d}`),
        distributorDoc(slug, { acceptingOrders: takesOrders(seeded), ...stamps }),
      );
      batch.set(
        doc(db, `distributors/${d}/private/control`),
        isApproved(seeded)
          ? seededControlDoc(founder, { status, trialEndsAt })
          : controlDoc(founder, { status, trialEndsAt, ...stamps }),
      );
      batch.set(doc(db, `slugs/${slug}`), { distributorId: d, createdAt: at });
      batch.set(doc(db, `distributors/${d}/private/settings`), privateDoc(founder, stamps));
      for (const [uid, role] of Object.entries(seeded.members)) {
        batch.set(doc(db, `distributors/${d}/members/${uid}`), memberDoc(d, uid, role, stamps));
        const owned = uid === founder ? [d] : [];
        batch.set(doc(db, `users/${uid}`), userDoc({ ownedDistributorIds: owned, ...stamps }));
      }
    }
    batch.set(doc(db, `users/${CUSTOMER_UID}`), userDoc(stamps));
    batch.set(doc(db, `users/${ADMIN_UID}`), userDoc(stamps));
    batch.set(doc(db, `platformAdmins/${ADMIN_UID}`), { createdAt: at });
    await batch.commit();
  });
}

/** Writes one document with the rules disabled. */
export async function seedDoc(
  env: RulesTestEnvironment,
  path: string,
  data: Record<string, unknown>,
): Promise<void> {
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));
}

/** A profile for a fresh account, so it can found distributors. */
export function seedProfile(env: RulesTestEnvironment, uid: string): Promise<void> {
  const at = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
  return seedDoc(env, `users/${uid}`, userDoc({ createdAt: at, updatedAt: at }));
}
