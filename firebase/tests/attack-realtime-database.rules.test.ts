// Realtime Database is closed until the tracking phase opens it. Nothing can be read or written,
// by anyone, at any depth, whatever the token claims.
import { readFileSync } from 'node:fs';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  get,
  limitToFirst,
  orderByKey,
  push,
  query,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from 'firebase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMULATOR_HOST, emulatorPorts } from '../../scripts/lane-ports.mjs';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-glpweb-attack-rtdb',
    database: {
      rules: readFileSync('firebase/database.rules.json', 'utf8'),
      host: EMULATOR_HOST,
      port: emulatorPorts().database,
    },
  });
  // What the tracking phase will hold, so a read that slips through would return something.
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), '/'), {
      locations: { 'dist-a': { 'driver-a': { lat: -12.05, lng: -77.04, ts: 1 } } },
      orderTracking: { 'order-1': { customerUid: 'customer', lat: -12.05, lng: -77.04 } },
      staff: { 'dist-a': { 'driver-a': 'driver', 'owner-a': 'owner' } },
    });
  });
});

afterAll(async () => {
  await env.cleanup();
});

const ACTORS: [string, () => RulesTestContext][] = [
  ['an anonymous visitor', () => env.unauthenticatedContext()],
  ['a customer', () => env.authenticatedContext('customer', { email_verified: true })],
  ['the driver the position belongs to', () => env.authenticatedContext('driver-a')],
  ['the owner of the distributor', () => env.authenticatedContext('owner-a')],
  ['a driver of another distributor', () => env.authenticatedContext('driver-b')],
  [
    'someone whose token claims every role',
    () =>
      env.authenticatedContext('pretender', {
        admin: true,
        platformAdmin: true,
        role: 'owner',
        distributorId: 'dist-a',
        email_verified: true,
      }),
  ],
];

const PATHS = [
  '/',
  'locations',
  'locations/dist-a',
  'locations/dist-a/driver-a',
  'locations/dist-a/driver-a/lat',
  'orderTracking',
  'orderTracking/order-1',
  'orderTracking/order-1/customerUid',
  'staff/dist-a/driver-a',
  'anything/else',
];

describe.each(ACTORS)('Realtime Database closed — %s', (_who, connect) => {
  it.each(PATHS)('cannot read %s', async (path) => {
    const db = connect().database();
    await assertFails(get(ref(db, path)));
  });

  it('cannot read through a query', async () => {
    const db = connect().database();
    await assertFails(get(query(ref(db, 'locations/dist-a'), orderByKey(), limitToFirst(1))));
    await assertFails(get(query(ref(db, 'orderTracking'), limitToFirst(1))));
  });

  it.each(PATHS)('cannot write %s', async (path) => {
    const db = connect().database();
    const position = { lat: -12.05, lng: -77.04, ts: 1 };
    await assertFails(set(ref(db, path), position));
    await assertFails(update(ref(db, path), { lat: 0 }));
    await assertFails(remove(ref(db, path)));
  });

  it('cannot push, run a transaction or write several paths at once', async () => {
    const db = connect().database();
    await assertFails(set(push(ref(db, 'locations/dist-a')), { lat: 0, lng: 0 }));
    await assertFails(runTransaction(ref(db, 'staff/dist-a/pretender'), () => 'owner'));
    await assertFails(
      update(ref(db), {
        'staff/dist-a/pretender': 'owner',
        'locations/dist-a/pretender': { lat: 999, lng: 999 },
      }),
    );
  });
});

describe('Realtime Database closed — nothing changed', () => {
  it('keeps the data exactly as it was seeded', async () => {
    let staff: unknown;
    await env.withSecurityRulesDisabled(async (context) => {
      staff = (await get(ref(context.database(), 'staff/dist-a'))).val();
    });
    expect(staff).toEqual({ 'driver-a': 'driver', 'owner-a': 'owner' });
  });
});
