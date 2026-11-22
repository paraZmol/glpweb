// What the role-walker specs of the plant (PLAN 3.3–3.5) share: a distributor of the test with
// a product, its stock, two vehicles, a live promotion and its staff, and the direct attempt a
// modified client would make against the rules. EVERYTHING HERE IS INVENTED.
import type { Page } from '@playwright/test';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../../scripts/lane-ports.mjs';
import type { Actors, Device } from './actors';
import { writeDocument } from './emulator-admin';
import { type OwnDistributor, ownDistributor } from './own-distributor';
import { signInAs } from './sign-in';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** The adjustment that left the first stock of a product (any 20 letters and digits). */
const FIRST_MOVE = 'RoleWalkerMove000000';

/** A distributor of the test with one 10 kg product at S/ 48, its stock, two vehicles and staff. */
export async function plant(tag: string): Promise<OwnDistributor> {
  const own = await ownDistributor(tag, {
    products: [{ id: 'p00', brand: 'Marca Uno', weightKg: 10, refillPriceCents: 4800 }],
    staff: [
      { key: 'central', role: 'dispatcher' },
      { key: 'reparto', role: 'driver' },
    ],
  });
  const now = new Date();
  const stamps = { createdAt: now, updatedAt: now };
  await writeDocument(`distributors/${own.id}/vehicles/v00`, {
    kind: 'motorcycle',
    name: 'Moto roja',
    plate: 'RWK-001',
    capacityCylinders: 3,
    active: true,
    ...stamps,
  });
  await writeDocument(`distributors/${own.id}/vehicles/v01`, {
    kind: 'tricycle',
    name: 'Trimoto vieja',
    plate: null,
    capacityCylinders: 8,
    active: false,
    ...stamps,
  });
  await writeDocument(`distributors/${own.id}/plantStock/p00`, {
    full: 40,
    empty: 10,
    lastMovementId: FIRST_MOVE,
    updatedAt: now,
  });
  await writeDocument(`distributors/${own.id}/stockMovements/${FIRST_MOVE}`, {
    kind: 'adjustment',
    productId: 'p00',
    reason: 'count',
    note: null,
    fullDelta: 40,
    emptyDelta: 10,
    fullAfter: 40,
    emptyAfter: 10,
    authorUid: own.founder.uid,
    authorName: own.founder.displayName,
    createdAt: now,
  });
  await writeDocument(`distributors/${own.id}/promotions/o00`, {
    title: 'S/ 3 menos',
    type: 'amountOff',
    amountCents: 300,
    productIds: ['p00'],
    saleMode: 'refill',
    startsAt: now,
    endsAt: new Date(now.getTime() + 5 * DAY_MS),
    active: true,
    maxUnitsPerOrder: 2,
    totalUnits: null,
    soldUnits: 0,
    conditions: '',
    createdBy: own.founder.uid,
    switchedOffBy: null,
    switchedOffAt: null,
    ...stamps,
  });
  return own;
}

export type Who = 'titular' | 'central' | 'reparto';

/** One person of the plant, signed in on `device` and standing on their own area. */
export async function openAs(actors: Actors, own: OwnDistributor, who: Who, device: Device) {
  const actor = await actors.open(device);
  const account = who === 'titular' ? own.founder : own.person(who);
  await signInAs(actor.page, account, who === 'reparto' ? '/reparto' : '/central');
  return actor;
}

/** The session token the page holds, to try what a modified client would send to the rules. */
export async function tokenOf(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open('firebaseLocalStorageDb');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const store = request.result
            .transaction('firebaseLocalStorage', 'readonly')
            .objectStore('firebaseLocalStorage');
          const all = store.getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            const entry = (
              all.result as {
                fbase_key: string;
                value?: { stsTokenManager?: { accessToken?: string } };
              }[]
            ).find((row) => row.fbase_key.startsWith('firebase:authUser'));
            resolve(entry?.value?.stsTokenManager?.accessToken ?? '');
          };
        };
      }),
  );
}

export const documents = () =>
  `http://${EMULATOR_HOST}:${emulatorPorts().firestore}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;

/** HTTP status the rules give to `token` reading a document or listing a collection of `d`. */
export async function directRead(
  token: string,
  d: string,
  what: string,
  limit = 0,
): Promise<number> {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (limit === 0)
    return (await fetch(`${documents()}/distributors/${d}/${what}`, { headers })).status;
  const response = await fetch(`${documents()}/distributors/${d}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: what }], limit } }),
  });
  return response.status;
}

export async function directPatch(token: string, path: string, fields: Record<string, unknown>) {
  const mask = Object.keys(fields)
    .map((field) => `updateMask.fieldPaths=${field}`)
    .join('&');
  const response = await fetch(`${documents()}/${path}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return response.status;
}

export const OK = 200;
export const DENIED = 403;
