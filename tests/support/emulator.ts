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
