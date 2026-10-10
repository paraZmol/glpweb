// Deterministic seed for the Firebase emulators (PLAN 2.4c). Never for a real project.
//
//   npm run seed                      → loads it into emulators that are already running
//   import { seedEmulators } from …   → the same thing from Playwright or Vitest
//
// It writes with the security rules disabled (the emulator's admin access), which is how a
// suspended distributor, an expired trial and a platform admin can exist at all: none of them
// can be created from the app. Runs with plain `node` (type stripping), so it only imports
// packages and `./data.ts`.
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, Timestamp, writeBatch } from 'firebase/firestore';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import {
  SEED_CREATED_AT,
  SEED_DISTRIBUTORS,
  SEED_PASSWORD,
  SEED_PRIVACY_VERSION,
  SEED_TERMS_VERSION,
  SEED_USERS,
  type SeedDistributor,
  type SeedUser,
} from './data.ts';

export interface SeedOptions {
  /** Must start with `demo-`: those ids can never reach a real Firebase project. */
  projectId?: string;
  /** Ports default to the lane in E2E_LANE (scripts/lane-ports.mjs). */
  firestorePort?: number;
  authPort?: number;
  /** Wipe Firestore and Auth of that emulator project first. Default true. */
  clear?: boolean;
}

export interface SeedSummary {
  projectId: string;
  users: number;
  distributors: number;
}

const DEFAULT_SCHEDULE = { days: [0, 1, 2, 3, 4, 5, 6], opensAt: '07:00', closesAt: '20:00' };
const DEFAULT_MAX_CYLINDERS_PER_ORDER = 3;

const createdAt = Timestamp.fromDate(new Date(SEED_CREATED_AT));
const stamps = { createdAt, updatedAt: createdAt };
const terms = { version: SEED_TERMS_VERSION, acceptedAt: createdAt };
const privacy = { version: SEED_PRIVACY_VERSION, acceptedAt: createdAt };

function founderOf(distributor: SeedDistributor): SeedUser {
  const founder = distributor.members.find((member) => member.role === 'owner');
  if (!founder) throw new Error(`Seed distributor ${distributor.id} has no owner`);
  return founder.user;
}

/** Same condition as `isWritable` in src/domain/tenancy/status.ts (this file imports no app code). */
function takesOrders(distributor: SeedDistributor): boolean {
  if (distributor.status === 'active') return true;
  return distributor.status === 'trial' && new Date(distributor.trialEndsAt) > new Date();
}

/** What anyone can read: no plan, no trial date, no account id (PLAN 2.9). */
function publicDocument(distributor: SeedDistributor) {
  return {
    name: distributor.name,
    slug: distributor.slug,
    contactPhone: distributor.contactPhone,
    whatsapp: distributor.contactPhone,
    addressLine: distributor.addressLine,
    plant: { ...distributor.plant },
    coverageRadiusKm: distributor.coverageRadiusKm,
    brandColor: distributor.brandColor,
    acceptingOrders: takesOrders(distributor),
    schedule: DEFAULT_SCHEDULE,
    maxCylindersPerOrder: DEFAULT_MAX_CYLINDERS_PER_ORDER,
    brands: [...distributor.brands],
    priceFromCents: distributor.priceFromCents,
    currency: 'PEN',
    ...stamps,
  };
}

function controlDocument(distributor: SeedDistributor) {
  return {
    ownerUid: founderOf(distributor).uid,
    status: distributor.status,
    trialEndsAt: Timestamp.fromDate(new Date(distributor.trialEndsAt)),
    ...stamps,
  };
}

function privateDocument(distributor: SeedDistributor) {
  const founder = founderOf(distributor);
  return {
    ownerUid: founder.uid,
    ownerName: founder.displayName,
    ownerPhone: founder.phone,
    ownerEmail: founder.email,
    plan: 'trial',
    terms,
    authorityDeclaredAt: createdAt,
    ...stamps,
  };
}

type Batch = ReturnType<typeof writeBatch>;
type Db = Parameters<typeof writeBatch>[0];

function writeDistributor(batch: Batch, db: Db, distributor: SeedDistributor) {
  const { id, slug } = distributor;
  batch.set(doc(db, `distributors/${id}`), publicDocument(distributor));
  batch.set(doc(db, `distributors/${id}/private/control`), controlDocument(distributor));
  batch.set(doc(db, `distributors/${id}/private/settings`), privateDocument(distributor));
  batch.set(doc(db, `slugs/${slug}`), { distributorId: id, createdAt });
  for (const { user, role } of distributor.members) {
    batch.set(doc(db, `distributors/${id}/members/${user.uid}`), {
      uid: user.uid,
      distributorId: id,
      role,
      active: true,
      displayName: user.displayName,
      distributorName: distributor.name,
      ...stamps,
    });
  }
}

function writeProfiles(batch: Batch, db: Db, distributors: SeedDistributor[]) {
  for (const user of Object.values(SEED_USERS)) {
    if (!user.hasProfile) continue;
    const founded = distributors.filter((distributor) => founderOf(distributor).uid === user.uid);
    batch.set(doc(db, `users/${user.uid}`), {
      displayName: user.displayName,
      phone: user.phone,
      ownedDistributorIds: founded.map((distributor) => distributor.id),
      terms,
      privacy,
      ...stamps,
    });
  }
  batch.set(doc(db, `platformAdmins/${SEED_USERS.admin.uid}`), { createdAt });
}

async function authRequest(authPort: number, method: string, path: string, body?: unknown) {
  const response = await fetch(`http://${EMULATOR_HOST}:${authPort}${path}`, {
    method,
    // `owner` is the emulator's admin bearer; it means nothing outside the emulator.
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Auth emulator ${method} ${path} → ${response.status} ${await response.text()}`,
    );
  }
}

async function seedAccounts(projectId: string, authPort: number, clear: boolean) {
  if (clear) await authRequest(authPort, 'DELETE', `/emulator/v1/projects/${projectId}/accounts`);
  const createPath = `/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;
  for (const user of Object.values(SEED_USERS)) {
    await authRequest(authPort, 'POST', createPath, {
      localId: user.uid,
      email: user.email,
      password: SEED_PASSWORD,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
    });
  }
}

export async function seedEmulators(options: SeedOptions = {}): Promise<SeedSummary> {
  const projectId = options.projectId ?? EMULATOR_PROJECT_ID;
  const ports = emulatorPorts();
  const clear = options.clear ?? true;
  if (!projectId.startsWith('demo-')) {
    throw new Error(`Refusing to seed "${projectId}": only demo-* emulator projects are allowed`);
  }
  const distributors: SeedDistributor[] = Object.values(SEED_DISTRIBUTORS);
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { host: EMULATOR_HOST, port: options.firestorePort ?? ports.firestore },
  });
  try {
    if (clear) await env.clearFirestore();
    await seedAccounts(projectId, options.authPort ?? ports.auth, clear);
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const batch = writeBatch(db);
      for (const distributor of distributors) writeDistributor(batch, db, distributor);
      writeProfiles(batch, db, distributors);
      await batch.commit();
    });
  } finally {
    await env.cleanup();
  }
  return { projectId, users: Object.keys(SEED_USERS).length, distributors: distributors.length };
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCommandLine) {
  seedEmulators({ projectId: process.env.SEED_PROJECT_ID })
    .then((summary) => {
      process.stdout.write(
        `Seeded ${summary.projectId}: ${summary.users} accounts, ${summary.distributors} distributors.\n` +
          `Every account uses the test password "${SEED_PASSWORD}".\n`,
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `Seed failed. Are the emulators running (npm run emulators)?\n${String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
