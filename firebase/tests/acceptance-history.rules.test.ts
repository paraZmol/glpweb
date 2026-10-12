// History of acceptances (PLAN 2.11): /users/{uid}/acceptances/{text}-{version}. An acceptance
// is two halves the rules only take together — the field of the profile and its line here — and
// the line is never edited, so it proves which version the account accepted, and when.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ACCEPTED_TEXTS,
  type AcceptedText,
  MAX_ACCEPTANCE_ENTRIES,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from '../../src/domain/legal/versions';
import {
  acceptOnProfile,
  ADMIN_UID,
  anonymous,
  createEnv,
  createProfile,
  currentEntry,
  CUSTOMER_UID,
  type Db,
  entryDoc,
  entryPath,
  privacyDoc,
  seedAcceptedProfile,
  seedWorld,
  termsDoc,
  unverified,
  verifiedThrough,
  userDoc,
  verified,
} from './helpers';

let env: RulesTestEnvironment;
const NEWCOMER = 'newcomer';
/** Holds the current versions, with their history. */
const SETTLED = 'settled';
/** Holds an older version of both texts, with that history: it has to accept both again. */
const BEHIND = 'behind';
/** Holds an older version of one text only, and the current one of the other. */
const BEHIND_IN = { terms: 'behind-in-terms', privacy: 'behind-in-privacy' } as const;
const OLD_VERSION = '0.0';
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const FUTURE = Timestamp.fromDate(new Date('2099-01-01T00:00:00Z'));
const CURRENT = { terms: TERMS_VERSION, privacy: PRIVACY_VERSION };
const ACCEPT = { terms: termsDoc, privacy: privacyDoc };
const stamp = { updatedAt: serverTimestamp() };

const historyOf = (db: Db, uid: string) => collection(db, `users/${uid}/acceptances`);

/** What the database holds, read with the rules out of the way. */
async function stored(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore(), path))).data();
  });
  return data;
}

/** The acceptance of `text` the profile holds: its version and its date. */
async function held(uid: string, text: AcceptedText) {
  const profile = await stored(`users/${uid}`);
  return profile?.[text] as { version: string; acceptedAt: Timestamp } | undefined;
}

beforeAll(async () => {
  env = await createEnv('acceptance-history');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedAcceptedProfile(env, SETTLED, CURRENT, PAST);
  await seedAcceptedProfile(env, BEHIND, { terms: OLD_VERSION, privacy: OLD_VERSION }, PAST);
  await seedAcceptedProfile(env, BEHIND_IN.terms, { ...CURRENT, terms: OLD_VERSION }, PAST);
  await seedAcceptedProfile(env, BEHIND_IN.privacy, { ...CURRENT, privacy: OLD_VERSION }, PAST);
});

afterAll(async () => {
  await env.cleanup();
});

describe('acceptances — a new profile leaves its two entries', () => {
  it('stores each entry with its text, its version and the date of the profile', async () => {
    await assertSucceeds(createProfile(verified(env, NEWCOMER), NEWCOMER));

    expect(await stored(entryPath(NEWCOMER, 'terms'))).toEqual({
      document: 'terms',
      ...(await held(NEWCOMER, 'terms')),
    });
    expect(await stored(entryPath(NEWCOMER, 'privacy'))).toEqual({
      document: 'privacy',
      ...(await held(NEWCOMER, 'privacy')),
    });
    expect(await held(NEWCOMER, 'terms')).toMatchObject({ version: TERMS_VERSION });
    expect(await held(NEWCOMER, 'privacy')).toMatchObject({ version: PRIVACY_VERSION });
  });

  it('blocks a profile that leaves no entry at all', async () => {
    const db = verified(env, NEWCOMER);

    await assertFails(setDoc(doc(db, `users/${NEWCOMER}`), userDoc()));
    await assertFails(createProfile(db, NEWCOMER, userDoc(), {}));
  });

  it.each([
    ['terms', currentEntry('privacy')],
    ['privacy', currentEntry('terms')],
  ])('blocks a profile that leaves no entry for the %s', async (_missing, entries) => {
    await assertFails(createProfile(verified(env, NEWCOMER), NEWCOMER, userDoc(), entries));
  });

  it('blocks the entries without the profile they prove', async () => {
    const db = verified(env, NEWCOMER);
    const batch = writeBatch(db);
    batch.set(doc(db, entryPath(NEWCOMER, 'terms')), entryDoc('terms'));
    batch.set(doc(db, entryPath(NEWCOMER, 'privacy')), entryDoc('privacy'));

    await assertFails(batch.commit());
  });

  it('blocks an account whose e-mail is not verified, entries included', async () => {
    await assertFails(createProfile(unverified(env, NEWCOMER), NEWCOMER));
  });

  // PLAN 2.1: sign-in is with Google only.
  it('blocks a verified session that did not come in through Google, entries included', async () => {
    await assertFails(createProfile(verifiedThrough(env, NEWCOMER, 'password'), NEWCOMER));
  });
});

describe.each(ACCEPTED_TEXTS)('acceptances — accepting a new version of the %s', (text) => {
  const other = text === 'terms' ? 'privacy' : 'terms';
  const accept = () => ({ [text]: ACCEPT[text]() });
  const BEHIND_HERE = BEHIND_IN[text];
  const behind = () => verified(env, BEHIND_HERE);

  it('takes the acceptance with its entry, and keeps the entry of the version before', async () => {
    await assertSucceeds(acceptOnProfile(behind(), BEHIND_HERE, accept()));

    expect(await held(BEHIND_HERE, text)).toMatchObject({ version: CURRENT[text] });
    expect(await stored(entryPath(BEHIND_HERE, text))).toEqual({
      document: text,
      ...(await held(BEHIND_HERE, text)),
    });
    expect(await stored(entryPath(BEHIND_HERE, text, OLD_VERSION))).toEqual({
      document: text,
      version: OLD_VERSION,
      acceptedAt: PAST,
    });
  });

  it('leaves the other text, its date and its entry as they were', async () => {
    await acceptOnProfile(behind(), BEHIND_HERE, accept());

    expect(await held(BEHIND_HERE, other)).toEqual({ version: CURRENT[other], acceptedAt: PAST });
    expect(await stored(entryPath(BEHIND_HERE, other))).toEqual({
      document: other,
      version: CURRENT[other],
      acceptedAt: PAST,
    });
  });

  it('blocks accepting in the profile without leaving the entry', async () => {
    const own = doc(behind(), `users/${BEHIND_HERE}`);

    await assertFails(updateDoc(own, { ...accept(), ...stamp }));
    await assertFails(acceptOnProfile(behind(), BEHIND_HERE, accept(), {}));
  });

  // PLAN 2.1: the line of the history is only written by a session that came in through Google.
  it.each(['password', 'custom'])(
    'blocks a verified session that came in through %s from accepting it',
    async (provider) => {
      const db = verifiedThrough(env, BEHIND_HERE, provider);

      await assertFails(acceptOnProfile(db, BEHIND_HERE, accept()));
    },
  );

  it('blocks accepting with the entry of the other text only', async () => {
    await assertFails(acceptOnProfile(behind(), BEHIND_HERE, accept(), currentEntry(other)));
  });

  it('blocks an entry without accepting in the profile', async () => {
    const db = behind();

    await assertFails(setDoc(doc(db, entryPath(BEHIND_HERE, text)), entryDoc(text)));
    await assertFails(
      acceptOnProfile(db, BEHIND_HERE, { displayName: 'C. Otra' }, currentEntry(text)),
    );
  });

  it('blocks an entry for a version the profile does not take in the same request', async () => {
    // The profile accepts the current version; the entry claims the one before.
    const stale = { [`${text}-stale`]: entryDoc(text, { version: OLD_VERSION }) };

    await assertFails(
      acceptOnProfile(behind(), BEHIND_HERE, accept(), { ...currentEntry(text), ...stale }),
    );
  });

  // The seeded customer holds the current version since long ago and has no history: only a
  // new acceptance in its profile can leave the entry, never the entry by itself.
  it('blocks dating today, with an entry alone, an acceptance the profile made long ago', async () => {
    const db = verified(env, CUSTOMER_UID);

    await assertFails(setDoc(doc(db, entryPath(CUSTOMER_UID, text)), entryDoc(text)));
  });

  // A version already in the history cannot be dated again: its entry is never edited.
  it('blocks accepting again a version that is already in the history', async () => {
    const db = verified(env, SETTLED);

    await assertFails(acceptOnProfile(db, SETTLED, accept()));
    await assertFails(updateDoc(doc(db, `users/${SETTLED}`), { ...accept(), ...stamp }));
    expect(await held(SETTLED, text)).toEqual({ version: CURRENT[text], acceptedAt: PAST });
  });

  it.each([
    ['a made-up date in the past', currentEntry(text, { acceptedAt: PAST })],
    ['a date in the future', currentEntry(text, { acceptedAt: FUTURE })],
    ['a date as text', currentEntry(text, { acceptedAt: '2026-10-11' })],
    ['no date', { [`${text}-${CURRENT[text]}`]: { document: text, version: CURRENT[text] } }],
    ['an extra key', currentEntry(text, { ip: '127.0.0.1' })],
    [
      'no document',
      { [`${text}-${CURRENT[text]}`]: { version: CURRENT[text], acceptedAt: serverTimestamp() } },
    ],
    ['the name of the other text', currentEntry(text, { document: other })],
    ['a text nobody accepts', currentEntry(text, { document: 'cookies' })],
    ['another version than its id says', currentEntry(text, { version: '9.9' })],
    ['a numeric version', currentEntry(text, { version: 0.2 })],
    ['an id of its own choosing', { kJ3xZ9automaticId0000: entryDoc(text) }],
    ['an id without the version', { [text]: entryDoc(text) }],
  ])('blocks an entry with %s', async (_case, entries) => {
    await assertFails(acceptOnProfile(behind(), BEHIND_HERE, accept(), entries));
  });

  it('blocks a second entry for the same acceptance under another id', async () => {
    const twice = { ...currentEntry(text), [`${text}-${CURRENT[text]}-bis`]: entryDoc(text) };

    await assertFails(acceptOnProfile(behind(), BEHIND_HERE, accept(), twice));
  });
});

describe('acceptances — both texts at once', () => {
  it('takes the two acceptances with their two entries', async () => {
    const both = { terms: termsDoc(), privacy: privacyDoc() };

    await assertSucceeds(acceptOnProfile(verified(env, BEHIND), BEHIND, both));
  });

  it('blocks the two acceptances with one entry', async () => {
    const both = { terms: termsDoc(), privacy: privacyDoc() };
    const db = verified(env, BEHIND);

    await assertFails(acceptOnProfile(db, BEHIND, both, currentEntry('terms')));
    await assertFails(acceptOnProfile(db, BEHIND, both, currentEntry('privacy')));
  });
});

describe('acceptances — nobody rewrites the proof', () => {
  const entry = (db: Db) => doc(db, entryPath(SETTLED, 'terms'));

  it.each([
    ['its holder', SETTLED],
    ['a platform admin', ADMIN_UID],
    ['another account', CUSTOMER_UID],
  ])('blocks %s from editing an entry', async (_who, uid) => {
    const db = verified(env, uid);

    await assertFails(updateDoc(entry(db), { acceptedAt: serverTimestamp() }));
    await assertFails(updateDoc(entry(db), { version: '9.9' }));
    await assertFails(setDoc(entry(db), entryDoc('terms')));
    await assertFails(setDoc(entry(db), { note: 'x' }, { merge: true }));
  });

  it.each([
    ['its holder', SETTLED],
    ['a platform admin', ADMIN_UID],
    ['another account', CUSTOMER_UID],
  ])('blocks %s from deleting an entry', async (_who, uid) => {
    await assertFails(deleteDoc(entry(verified(env, uid))));
  });

  it('blocks deleting an entry and writing it again in one request', async () => {
    const db = verified(env, SETTLED);
    const batch = writeBatch(db);
    batch.delete(entry(db));
    batch.set(entry(db), entryDoc('terms'));
    batch.update(doc(db, `users/${SETTLED}`), { terms: termsDoc(), ...stamp });

    await assertFails(batch.commit());
  });
});

describe('acceptances — who reads the history', () => {
  it('lets the account read and list its own history', async () => {
    const db = verified(env, SETTLED);

    await assertSucceeds(getDoc(doc(db, entryPath(SETTLED, 'terms'))));
    const listed = await assertSucceeds(
      getDocs(query(historyOf(db, SETTLED), limit(MAX_ACCEPTANCE_ENTRIES))),
    );
    expect(listed.docs.map((each) => each.id).sort()).toEqual([
      `privacy-${PRIVACY_VERSION}`,
      `terms-${TERMS_VERSION}`,
    ]);
  });

  it('lets the account read its history even before its e-mail is verified again', async () => {
    await assertSucceeds(getDoc(doc(unverified(env, SETTLED), entryPath(SETTLED, 'terms'))));
  });

  it('lets a platform admin read and list the history of any account', async () => {
    const db = verified(env, ADMIN_UID);

    await assertSucceeds(getDoc(doc(db, entryPath(SETTLED, 'privacy'))));
    await assertSucceeds(getDocs(query(historyOf(db, SETTLED), limit(MAX_ACCEPTANCE_ENTRIES))));
  });

  it.each([
    ['the account itself', SETTLED],
    ['a platform admin', ADMIN_UID],
  ])('blocks %s from listing without the cap', async (_who, uid) => {
    const db = verified(env, uid);

    await assertFails(getDocs(historyOf(db, SETTLED)));
    await assertFails(getDocs(query(historyOf(db, SETTLED), limit(MAX_ACCEPTANCE_ENTRIES + 1))));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['another customer', () => verified(env, CUSTOMER_UID)],
    ['the owner of a distributor', () => verified(env, 'owner-a')],
    ['a dispatcher', () => verified(env, 'dispatcher-a')],
    ['a driver of another distributor', () => verified(env, 'driver-b')],
    ['the owner of a suspended distributor', () => verified(env, 'owner-suspended')],
  ])('blocks %s from reading or writing the history of an account', async (_who, connect) => {
    const db = connect();

    await assertFails(getDoc(doc(db, entryPath(SETTLED, 'terms'))));
    await assertFails(getDocs(query(historyOf(db, SETTLED), limit(5))));
    await assertFails(setDoc(doc(db, entryPath(SETTLED, 'terms', '9.9')), entryDoc('terms')));
    await assertFails(setDoc(doc(db, entryPath(BEHIND, 'terms')), entryDoc('terms')));
    await assertFails(updateDoc(doc(db, entryPath(SETTLED, 'terms')), { version: '9.9' }));
    await assertFails(deleteDoc(doc(db, entryPath(SETTLED, 'terms'))));
  });

  it('blocks an account from slipping an entry into the history of another while it accepts', async () => {
    // It really accepts on its own profile, which alone would pass, and tries to date an
    // entry for another account in the same request.
    const uid = BEHIND_IN.terms;
    const db = verified(env, uid);
    const batch = writeBatch(db);
    batch.update(doc(db, `users/${uid}`), { terms: termsDoc(), ...stamp });
    batch.set(doc(db, entryPath(uid, 'terms')), entryDoc('terms'));
    batch.set(doc(db, entryPath(CUSTOMER_UID, 'terms')), entryDoc('terms'));

    await assertFails(batch.commit());
  });

  it('blocks reading every history at once, even for a platform admin', async () => {
    const everyHistory = (uid: string) =>
      query(collectionGroup(verified(env, uid), 'acceptances'), limit(1));

    await assertFails(getDocs(everyHistory(ADMIN_UID)));
    await assertFails(getDocs(everyHistory(SETTLED)));
  });
});
