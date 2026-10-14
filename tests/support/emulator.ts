// Admin shortcuts into the Firestore emulator for repository and browser tests. Emulators only: the
// `owner` bearer is the emulator's admin token and means nothing anywhere else.
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';

export { EMULATOR_PROJECT_ID };

async function firestoreAdmin(method: string, path: string, body?: unknown): Promise<void> {
  const base = `http://${EMULATOR_HOST}:${emulatorPorts().firestore}/v1/projects/${EMULATOR_PROJECT_ID}`;
  const response = await fetch(`${base}/databases/(default)/documents/${path}`, {
    method,
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Firestore emulator ${method} ${path} → ${response.status}`);
}

/**
 * Whether a document exists, read as the emulator's admin: for a session the rules no longer
 * let read even its own data (PLAN §11, 2026-10-14).
 */
export async function documentExistsAsAdmin(path: string): Promise<boolean> {
  const base = `http://${EMULATOR_HOST}:${emulatorPorts().firestore}/v1/projects/${EMULATOR_PROJECT_ID}`;
  const response = await fetch(`${base}/databases/(default)/documents/${path}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Firestore emulator GET ${path} → ${response.status}`);
  return true;
}

export interface Rewind {
  /** The version the profile holds now; its entry of the history is removed. */
  from: string;
  /** The older version it will hold instead, with its own entry. */
  to: string;
  at: Date;
}

/**
 * Leaves an account as if the last version of `text` it accepted were an older one: the field
 * of its profile and its history say `to`, accepted on `at`. Rules bypassed, like the seed: no
 * client can put an account in that state, only the publication of a new version does.
 */
export async function rewindAcceptance(
  uid: string,
  text: 'terms' | 'privacy',
  { from, to, at }: Rewind,
): Promise<void> {
  const held = {
    version: { stringValue: to },
    acceptedAt: { timestampValue: at.toISOString() },
  };
  await firestoreAdmin('PATCH', `users/${uid}?updateMask.fieldPaths=${text}`, {
    fields: { [text]: { mapValue: { fields: held } } },
  });
  await firestoreAdmin('DELETE', `users/${uid}/acceptances/${text}-${from}`);
  await firestoreAdmin('PATCH', `users/${uid}/acceptances/${text}-${to}`, {
    fields: { document: { stringValue: text }, ...held },
  });
}

/**
 * Marks the e-mail of an Auth account as verified, as the emulator's admin. Only for tests that
 * build a session the app itself can no longer open (PLAN 2.1) to prove the rules refuse it.
 */
export async function markEmailVerifiedAsAdmin(uid: string): Promise<void> {
  const base = `http://${EMULATOR_HOST}:${emulatorPorts().auth}`;
  const path = `/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}/accounts:update`;
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  });
  if (!response.ok) throw new Error(`Auth emulator accounts:update → ${response.status}`);
}
