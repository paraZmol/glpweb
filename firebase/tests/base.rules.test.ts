import { readFileSync } from 'node:fs';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, set } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-glpweb',
    firestore: {
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    database: {
      rules: readFileSync('firebase/database.rules.json', 'utf8'),
      host: '127.0.0.1',
      port: 9000,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('deny by default', () => {
  it('blocks anonymous visitors from an undeclared Firestore collection', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'anything/x')));
    await assertFails(setDoc(doc(db, 'anything/x'), { a: 1 }));
  });

  it('blocks signed-in users from an undeclared Firestore collection', async () => {
    const db = env.authenticatedContext('user-a').firestore();
    await assertFails(getDoc(doc(db, 'distributors/d1')));
    await assertFails(setDoc(doc(db, 'platformAdmins/user-a'), { since: 1 }));
  });

  it('blocks reads and writes on Realtime Database', async () => {
    const rtdb = env.authenticatedContext('user-a').database();
    await assertFails(get(ref(rtdb, 'locations/d1/user-a')));
    await assertFails(set(ref(rtdb, 'locations/d1/user-a'), { lat: 0, lng: 0 }));
  });
});
