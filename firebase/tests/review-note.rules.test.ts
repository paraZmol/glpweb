// PLAN 3.2 — the note a platform admin leaves when it sends a listing back lives apart from the
// control document (`private/review`): the whole staff reads the control document, and the note
// may speak of the RUC or the record of the founder. The founder and platform admins read it;
// the control document keeps only the mark that a note waits.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PENDING_LISTINGS_LIMIT, REVIEW_NOTE_MAX_LENGTH } from '../../src/domain/tenancy/constants';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  leaveNote,
  memberDoc,
  reviewPath,
  seedDoc,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const PENDING = WORLD.pending.d;
const NOTE = 'El RUC no coincide con la razón social.';
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const admin = () => verified(env, ADMIN_UID);
const reviewOf = (db: Db, d = PENDING) => doc(db, reviewPath(d));
const controlOf = (db: Db, d = PENDING) => doc(db, `distributors/${d}/private/control`);

beforeAll(async () => {
  env = await createEnv('review-note');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedDoc(
    env,
    `distributors/${PENDING}/members/co-owner`,
    memberDoc(PENDING, 'co-owner', 'owner', { createdAt: PAST, updatedAt: PAST }),
  );
  await leaveNote(admin(), PENDING, NOTE);
});

afterAll(async () => {
  await env.cleanup();
});

describe('the note — who reads it', () => {
  it.each([
    ['the founder', 'owner-pending'],
    ['a platform admin', ADMIN_UID],
  ])('lets %s read its text', async (_who, uid) => {
    const read = await assertSucceeds(getDoc(reviewOf(verified(env, uid))));
    expect(read.get('note')).toBe(NOTE);
  });

  it.each([
    ['an owner who did not found it', 'co-owner'],
    ['its driver', 'driver-pending'],
    ['a customer', CUSTOMER_UID],
    ['the owner of another distributor', 'owner-a'],
  ])('blocks %s from reading its text', async (_who, uid) => {
    await assertFails(getDoc(reviewOf(verified(env, uid))));
  });

  it('blocks an anonymous visitor', async () => {
    await assertFails(getDoc(reviewOf(anonymous(env))));
  });

  it('still shows the rest of the staff that a note waits', async () => {
    const control = await assertSucceeds(getDoc(controlOf(verified(env, 'driver-pending'))));
    expect(control.get('reviewNoteAt')).toBeInstanceOf(Timestamp);
    expect(control.get('reviewNote')).toBeUndefined();
  });

  it('keeps the note out of the lists of the platform', async () => {
    const waiting = query(
      collectionGroup(admin(), 'private'),
      where('listingApproved', '==', false),
      limit(PENDING_LISTINGS_LIMIT),
    );
    const found = await assertSucceeds(getDocs(waiting));
    expect(found.docs.map((snapshot) => snapshot.id)).not.toContain('review');
  });
});

describe('the note — who writes it', () => {
  it('lets the admin replace it, mark and text together', async () => {
    await assertSucceeds(leaveNote(admin(), PENDING, 'Falta el registro.'));
  });

  it('accepts a note at the maximum length', async () => {
    await assertSucceeds(leaveNote(admin(), PENDING, 'n'.repeat(REVIEW_NOTE_MAX_LENGTH)));
  });

  it.each([
    ['an empty note', ''],
    ['a blank note', '   '],
    ['an oversized note', 'n'.repeat(REVIEW_NOTE_MAX_LENGTH + 1)],
    ['a note that is not text', 7],
  ])('blocks %s', async (_case, note) => {
    await assertFails(leaveNote(admin(), PENDING, note));
  });

  it('blocks the text without its mark in the control document', async () => {
    await assertFails(setDoc(reviewOf(admin()), { note: 'Otra.', writtenAt: serverTimestamp() }));
  });

  it('blocks the mark without its text', async () => {
    await assertFails(
      updateDoc(controlOf(admin()), {
        reviewNoteAt: serverTimestamp(),
        correctedAt: deleteField(),
        ...stamp,
      }),
    );
  });

  it('blocks a text dated other than now', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db), { reviewNoteAt: serverTimestamp(), ...stamp });
    batch.set(reviewOf(db), { note: 'Otra.', writtenAt: PAST });
    await assertFails(batch.commit());
  });

  it('blocks a text with anything else in it', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db), { reviewNoteAt: serverTimestamp(), ...stamp });
    batch.set(reviewOf(db), { note: 'Otra.', writtenAt: serverTimestamp(), by: ADMIN_UID });
    await assertFails(batch.commit());
  });

  it('lets the admin delete the text when the mark goes', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db), { reviewNoteAt: deleteField(), ...stamp });
    batch.delete(reviewOf(db));
    await assertSucceeds(batch.commit());
  });

  it('blocks deleting the text while its mark stays', async () => {
    await assertFails(deleteDoc(reviewOf(admin())));
  });

  it.each([
    ['the founder', 'owner-pending'],
    ['an owner who did not found it', 'co-owner'],
    ['its driver', 'driver-pending'],
    ['the owner of another distributor', 'owner-a'],
  ])('blocks %s from writing or deleting the text', async (_who, uid) => {
    const db = verified(env, uid);
    await assertFails(setDoc(reviewOf(db), { note: 'Ya está.', writtenAt: serverTimestamp() }));
    await assertFails(updateDoc(reviewOf(db), { note: 'Ya está.' }));
    await assertFails(deleteDoc(reviewOf(db)));
  });
});
