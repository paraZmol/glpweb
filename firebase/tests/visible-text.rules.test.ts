// rules-breaker (PLAN 3.1, low) closed in PLAN 3.2: the brand and the name of a product, the
// brands of the public profile and the name of a distributor are text people read. None of them
// takes a control or format character anywhere (U+0000, U+0007, U+200B, U+202E…), and each one
// carries at least one letter or digit, so a brand can no longer look blank.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  createEnv,
  editIdentity,
  productDoc,
  productPath,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const stamp = { updatedAt: serverTimestamp() };
const owner = () => verified(env, 'owner-a');

beforeAll(async () => {
  env = await createEnv('visible-text');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

const INVISIBLE: [string, string][] = [
  ['a zero-width space alone', '​'],
  ['a zero-width space inside', 'Marca​Uno'],
  ['a NUL inside', 'Marca\u0000Uno'],
  ['a bell at the end', 'Marca Uno\u0007'],
  ['a right-to-left override', '‮onU acraM'],
  ['a soft hyphen inside', 'Marca­Uno'],
  ['a new line inside', 'Marca\nUno'],
  ['punctuation only', '---'],
  ['an emoji only', '🔥🔥'],
];

const VISIBLE: [string, string][] = [
  ['a plain brand', 'Marca Uno'],
  ['tildes and ñ', 'Ñandú Gas'],
  ['an emoji next to a word', 'Gas 🔥'],
  ['a single digit', '7'],
];

describe('the brand and the name of a product', () => {
  it.each(VISIBLE)('accept %s', async (_case, text) => {
    await assertSucceeds(setDoc(doc(owner(), productPath(A, 'p00')), productDoc({ brand: text })));
  });

  it.each(INVISIBLE)('refuse a brand with %s', async (_case, text) => {
    await assertFails(setDoc(doc(owner(), productPath(A, 'p00')), productDoc({ brand: text })));
  });

  it.each(INVISIBLE)('refuse a name with %s', async (_case, text) => {
    const name = text.length < 2 ? `${text}${text}` : text;
    await assertFails(setDoc(doc(owner(), productPath(A, 'p00')), productDoc({ name })));
  });

  it('refuses an edit that brings an invisible character in', async () => {
    await setDoc(doc(owner(), productPath(A, 'p00')), productDoc());
    const product = doc(owner(), productPath(A, 'p00'));
    await assertFails(updateDoc(product, { brand: 'Marca​Uno', ...stamp }));
    await assertFails(updateDoc(product, { name: 'Balón\u0000 10 kg', ...stamp }));
  });
});

describe('the brands of the public profile', () => {
  const profile = () => doc(owner(), `distributors/${A}`);

  it.each(VISIBLE)('accept %s', async (_case, text) => {
    await assertSucceeds(updateDoc(profile(), { brands: ['Marca Dos', text], ...stamp }));
  });

  it.each(INVISIBLE)('refuse a brand with %s', async (_case, text) => {
    await assertFails(updateDoc(profile(), { brands: ['Marca Dos', text], ...stamp }));
  });

  it('refuses an invisible brand in the eighth position too', async () => {
    const brands = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', '​'];
    await assertFails(updateDoc(profile(), { brands, ...stamp }));
  });
});

describe('the name of a distributor', () => {
  it('accepts a name with a letter or digit', async () => {
    await assertSucceeds(editIdentity(owner(), A, { name: 'Gas Ñandú 24' }));
  });

  it.each(INVISIBLE)('refuses a name with %s', async (_case, text) => {
    const name = text.length < 2 ? `${text}${text}` : text;
    await assertFails(editIdentity(owner(), A, { name }));
  });
});
