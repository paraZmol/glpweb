// Admin access to the emulators of the lane for browser tests: accounts a test creates for
// itself and the state the database ended in. Emulators only: the `owner` bearer is the
// emulator's admin token and means nothing anywhere else. EVERYTHING HERE IS INVENTED.
import { randomUUID } from 'node:crypto';
import type { TestInfo } from '@playwright/test';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../../scripts/lane-ports.mjs';
import {
  SEED_PASSWORD,
  SEED_PRIVACY_VERSION,
  SEED_TERMS_VERSION,
  type SeedUser,
} from '../../seed/data';

const ADMIN_HEADERS = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const NOT_FOUND = 404;
const TAG_RANDOM_LENGTH = 8;
/** A version no account can hold any more: whoever has it must accept again. */
const OUTDATED_VERSION = '0.0';
/** Follows the fake pattern 9000000xx of the seed. */
const TEST_PHONE = '900000099';

const authUrl = (path: string) => `http://${EMULATOR_HOST}:${emulatorPorts().auth}${path}`;
const documentUrl = (path: string) =>
  `http://${EMULATOR_HOST}:${emulatorPorts().firestore}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${path}`;

async function adminRequest(url: string, method: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    headers: ADMIN_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function mustSucceed(response: Response, what: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${what} → ${response.status} ${await response.text()}`);
  return response.json();
}

/** Lower-case and safe in an e-mail, a document id and a link: unique per test and repetition. */
export function uniqueTag(testInfo: TestInfo): string {
  const random = randomUUID().replaceAll('-', '').slice(0, TAG_RANDOM_LENGTH);
  return `${testInfo.project.name}-${random}`;
}

// ------------------------------------------------------------------------------ Firestore ---

type FirestoreValue = Record<string, unknown>;

function encode(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
}

function encodeFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));
}

function decode(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('arrayValue' in value) {
    const { values = [] } = value.arrayValue as { values?: FirestoreValue[] };
    return values.map(decode);
  }
  if ('mapValue' in value) {
    const { fields = {} } = value.mapValue as { fields?: Record<string, FirestoreValue> };
    return decodeFields(fields);
  }
  // stringValue, booleanValue, doubleValue, timestampValue (as its ISO text)…
  return Object.values(value)[0];
}

function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

/** Writes a document with the security rules bypassed, like the seed does. */
export async function writeDocument(path: string, data: Record<string, unknown>): Promise<void> {
  const response = await adminRequest(documentUrl(path), 'PATCH', { fields: encodeFields(data) });
  await mustSucceed(response, `Firestore emulator PATCH ${path}`);
}

/** Removes a document a test wrote for itself. Nothing happens when it is not there. */
export async function deleteDocument(path: string): Promise<void> {
  const response = await adminRequest(documentUrl(path), 'DELETE');
  await mustSucceed(response, `Firestore emulator DELETE ${path}`);
}

/** What the database holds at `path` right now, or null when there is no such document. */
export async function readDocument(path: string): Promise<Record<string, unknown> | null> {
  const response = await adminRequest(documentUrl(path), 'GET');
  if (response.status === NOT_FOUND) return null;
  const { fields = {} } = (await mustSucceed(response, `Firestore emulator GET ${path}`)) as {
    fields?: Record<string, FirestoreValue>;
  };
  return decodeFields(fields);
}

// ----------------------------------------------------------------------------------- Auth ---

export interface AuthAccount {
  localId: string;
  email: string;
  emailVerified: boolean;
}

/** The Auth account that uses `email`, or null when nobody does. */
export async function findAuthAccount(email: string): Promise<AuthAccount | null> {
  const path = `/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}/accounts:lookup`;
  const response = await adminRequest(authUrl(path), 'POST', { email: [email] });
  const { users = [] } = (await mustSucceed(response, 'Auth emulator accounts:lookup')) as {
    users?: AuthAccount[];
  };
  return users[0] ?? null;
}

/**
 * What the profile of a new account looks like:
 * - `current`: accepted the terms and the privacy policy in force (a normal account);
 * - `none`: no profile at all (a first Google sign-in);
 * - `outdated`: accepted versions that are no longer in force;
 * - `privacyMissing`: an account from before the second box of the registration.
 */
export type TestProfile = 'current' | 'none' | 'outdated' | 'privacyMissing';

export interface TestAccountOptions {
  emailVerified?: boolean;
  profile?: TestProfile;
}

function profileDocument(account: SeedUser, kind: Exclude<TestProfile, 'none'>) {
  const now = new Date();
  const isCurrent = kind === 'current' || kind === 'privacyMissing';
  const terms = {
    version: isCurrent ? SEED_TERMS_VERSION : OUTDATED_VERSION,
    acceptedAt: now,
  };
  const privacy = {
    version: kind === 'current' ? SEED_PRIVACY_VERSION : OUTDATED_VERSION,
    acceptedAt: now,
  };
  return {
    displayName: account.displayName,
    phone: account.phone,
    ownedDistributorIds: [],
    terms,
    ...(kind === 'privacyMissing' ? {} : { privacy }),
    createdAt: now,
    updatedAt: now,
  };
}

interface Held {
  version: string;
  acceptedAt: Date;
}

/** The profile and, like the app does, one entry of the history for each text it accepted. */
async function writeProfile(account: SeedUser, kind: Exclude<TestProfile, 'none'>): Promise<void> {
  const document = profileDocument(account, kind);
  await writeDocument(`users/${account.uid}`, document);
  const accepted: Record<string, Held | undefined> = {
    terms: document.terms,
    privacy: document.privacy,
  };
  for (const [text, held] of Object.entries(accepted)) {
    if (!held) continue;
    const path = `users/${account.uid}/acceptances/${text}-${held.version}`;
    await writeDocument(path, { document: text, ...held });
  }
}

/**
 * Creates an account only this test uses (password: `SEED_PASSWORD`), so the test can verify
 * it, accept with it, found with it or delete it without touching the seeded ones. By default
 * it is a verified customer with a current profile.
 */
export async function createTestAccount(
  tag: string,
  { emailVerified = true, profile = 'current' }: TestAccountOptions = {},
): Promise<SeedUser> {
  const account: SeedUser = {
    uid: `e2e-${tag}`,
    email: `e2e-${tag}@example.com`,
    displayName: `Z. Prueba ${tag}`,
    phone: TEST_PHONE,
    emailVerified,
    hasProfile: profile !== 'none',
  };
  const createPath = `/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}/accounts`;
  const response = await adminRequest(authUrl(createPath), 'POST', {
    localId: account.uid,
    email: account.email,
    password: SEED_PASSWORD,
    displayName: account.displayName,
    emailVerified,
  });
  await mustSucceed(response, 'Auth emulator create account');
  if (profile !== 'none') await writeProfile(account, profile);
  return account;
}
