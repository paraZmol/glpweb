// Admin shortcuts into the emulators for repository and browser tests. Emulators only: the
// `owner` bearer is the emulator's admin token and means nothing anywhere else.
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';

export { EMULATOR_PROJECT_ID };

async function authAdmin(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`http://${EMULATOR_HOST}:${emulatorPorts().auth}${path}`, {
    method,
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Auth emulator ${path} → ${response.status}`);
  return response.json();
}

async function firestoreAdmin(method: string, path: string, body?: unknown): Promise<void> {
  const base = `http://${EMULATOR_HOST}:${emulatorPorts().firestore}/v1/projects/${EMULATOR_PROJECT_ID}`;
  const response = await fetch(`${base}/databases/(default)/documents/${path}`, {
    method,
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Firestore emulator ${method} ${path} → ${response.status}`);
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

/** What following the link of the verification e-mail does. */
export async function markEmailVerified(uid: string): Promise<void> {
  const path = `/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}/accounts:update`;
  await authAdmin('POST', path, { localId: uid, emailVerified: true });
}

export interface OutOfBandCode {
  email: string;
  requestType: string;
  oobCode: string;
}

/** E-mails the Auth emulator "sent" (verification, password reset) since it was cleared. */
export async function sentAuthEmails(): Promise<OutOfBandCode[]> {
  const path = `/emulator/v1/projects/${EMULATOR_PROJECT_ID}/oobCodes`;
  const { oobCodes } = (await authAdmin('GET', path)) as { oobCodes?: OutOfBandCode[] };
  return oobCodes ?? [];
}
