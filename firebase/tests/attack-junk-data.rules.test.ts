// Junk and abuse: values that pass a naive type check (blank text, look-alike digits, trailing
// line breaks, NaN, repeated list items, oversized lists) written straight with the SDK, as an
// attacker would, skipping the forms and src/domain.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISTRIBUTOR_NAME_MAX_LENGTH,
  MAX_ADDRESSES_PER_USER,
} from '../../src/domain/tenancy/constants';
import {
  addressDoc,
  createEnv,
  CUSTOMER_UID,
  foundDistributor,
  type FoundingOptions,
  memberDoc,
  newDistributorId,
  privateDoc,
  seedDoc,
  seedProfile,
  seedWorld,
  distributorDoc,
  userDoc,
  verified,
  WORLD,
  editIdentity,
} from './helpers';

let env: RulesTestEnvironment;
const FOUNDER = 'founder';
const NEW = {
  d: newDistributorId('New'),
  uid: FOUNDER,
  slug: 'gas-nuevo',
} satisfies FoundingOptions;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const old = { createdAt: PAST, updatedAt: PAST };
const SCHEDULE = { days: [1, 2, 3], opensAt: '07:00', closesAt: '20:00' };

beforeAll(async () => {
  env = await createEnv('attack-junk');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedProfile(env, FOUNDER);
});

afterAll(async () => {
  await env.cleanup();
});

// A new name sends the listing back to review (PLAN 2.11), so it travels in that batch.
const ownerEdit = (change: Record<string, unknown>) =>
  'name' in change
    ? editIdentity(verified(env, 'owner-a'), WORLD.a.d, change)
    : updateDoc(doc(verified(env, 'owner-a'), `distributors/${WORLD.a.d}`), {
        ...change,
        ...stamp,
      });

describe('public profile — text that shows as nothing', () => {
  it.each([
    ['only spaces', '   '],
    ['only tabs and line breaks', '\t\n\r\n'],
    ['only non-breaking spaces', '\u00a0\u00a0\u00a0'],
    ['only ideographic spaces', '\u3000\u3000'],
    ['only byte-order marks', '\ufeff\ufeff'],
    ['a thin space after the name', 'Gas Demo\u2009'],
    ['a vertical tab before the name', '\u000bGas Demo'],
    ['a space before the name', ' Gas Demo'],
    ['a space after the name', 'Gas Demo '],
    ['a line break after the name', 'Gas Demo\n'],
    ['only zero-width spaces', '​​​'],
    ['only a right-to-left override', '‮‮'],
    ['only punctuation', '......'],
    ['only emoji', '🔥🔥'],
  ])('blocks a distributor name with %s, when editing and when founding', async (_case, name) => {
    await assertFails(ownerEdit({ name }));
    const distributor = distributorDoc(NEW.slug, { name });
    const member = memberDoc(NEW.d, FOUNDER, 'owner', { distributorName: name });
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, distributor, member }));
  });

  it('accepts a name at the maximum length with accents and ñ', async () => {
    await assertSucceeds(ownerEdit({ name: 'ñ'.repeat(DISTRIBUTOR_NAME_MAX_LENGTH) }));
    await assertSucceeds(ownerEdit({ name: 'Gas Ñandú del Perú' }));
    await assertSucceeds(ownerEdit({ name: 'Gas  Demo\u00a0Norte' }));
    await assertSucceeds(ownerEdit({ name: 'A1' }));
    await assertSucceeds(ownerEdit({ name: '24 Horas \ud83d\udd25' }));
  });

  it.each([
    ['a blank brand', [' ']],
    ['a brand with a space at the end', ['Marca Uno ']],
    ['a blank address line', { addressLine: '   ' }],
  ])('blocks %s', async (_case, value) => {
    await assertFails(ownerEdit(Array.isArray(value) ? { brands: value } : value));
  });
});

describe('public profile — values that only look valid', () => {
  it.each([
    ['a phone with a line break at the end', { contactPhone: '900000001\n' }],
    ['a phone in Arabic-Indic digits', { contactPhone: '9٠٠٠٠٠٠٠١' }],
    ['a phone in full-width digits', { whatsapp: '９00000001' }],
    ['a phone with a zero-width space', { whatsapp: '9000​00001' }],
    ['a phone as a list', { contactPhone: ['900000001'] }],
    ['a colour with a line break at the end', { brandColor: '#d9480f\n' }],
    ['a three-digit colour', { brandColor: '#d94' }],
    ['a colour with alpha', { brandColor: '#d9480f80' }],
    ['a colour as a CSS function', { brandColor: 'rgb(0,0,0)' }],
    ['an opening time with a line break', { schedule: { ...SCHEDULE, opensAt: '07:00\n' } }],
    ['a closing time with seconds', { schedule: { ...SCHEDULE, closesAt: '20:00:00' } }],
    ['the same day repeated', { schedule: { ...SCHEDULE, days: [1, 1] } }],
    ['one day seven times', { schedule: { ...SCHEDULE, days: [3, 3, 3, 3, 3, 3, 3] } }],
    ['half a day', { schedule: { ...SCHEDULE, days: [1.5] } }],
    ['a day as text', { schedule: { ...SCHEDULE, days: ['1'] } }],
    ['a negative day', { schedule: { ...SCHEDULE, days: [-1] } }],
    ['days as a map', { schedule: { ...SCHEDULE, days: { 0: 1 } } }],
    ['a NaN coverage radius', { coverageRadiusKm: Number.NaN }],
    ['an infinite coverage radius', { coverageRadiusKm: Number.POSITIVE_INFINITY }],
    ['a coverage radius just under the minimum', { coverageRadiusKm: 0.999 }],
    ['a NaN plant', { plant: { lat: Number.NaN, lng: Number.NaN } }],
    ['an infinite plant', { plant: { lat: Number.NEGATIVE_INFINITY, lng: 0 } }],
    ['a plant just off the globe', { plant: { lat: 90.000001, lng: 0 } }],
    ['a plant as a list', { plant: [-12, -77] }],
    ['a plant holding a megabyte', { plant: { lat: 0, lng: 0, pad: 'x'.repeat(900_000) } }],
    ['NaN cylinders per order', { maxCylindersPerOrder: Number.NaN }],
    ['a NaN price', { priceFromCents: Number.NaN }],
    ['a brand as a map', { brands: [{ name: 'Marca Uno' }] }],
    ['a thousand brands', { brands: Array.from({ length: 1000 }, (_, index) => `M${index}`) }],
    ['currency in lower case', { currency: 'pen' }],
  ])('blocks an owner edit with %s', async (_case, change) => {
    await assertFails(ownerEdit(change));
  });
});

describe('account — junk in the profile and the addresses', () => {
  const own = () => doc(verified(env, CUSTOMER_UID), `users/${CUSTOMER_UID}`);
  const address = (slot: string) =>
    doc(verified(env, CUSTOMER_UID), `users/${CUSTOMER_UID}/addresses/${slot}`);

  it.each([
    ['a blank name', { displayName: '  ' }],
    ['a name that is one line break', { displayName: '\n' }],
    ['a name with a space at the end', { displayName: 'C. Persona ' }],
    ['a phone with a line break at the end', { phone: '900000010\n' }],
    ['a phone in Arabic-Indic digits', { phone: '9٠٠٠٠٠٠١٠' }],
    ['a phone as false', { phone: false }],
    ['a name as a list', { displayName: ['C', 'P'] }],
  ])('blocks a profile with %s, on create and on update', async (_case, change) => {
    await assertFails(updateDoc(own(), { ...change, ...stamp }));
    await assertFails(setDoc(doc(verified(env, 'newcomer'), 'users/newcomer'), userDoc(change)));
  });

  it('accepts a name at the maximum length with accents', async () => {
    await assertSucceeds(
      updateDoc(own(), { displayName: 'é'.repeat(DISPLAY_NAME_MAX_LENGTH), ...stamp }),
    );
  });

  it.each([
    ['a blank label', { label: '   ' }],
    ['a blank address line', { addressLine: ' \n ' }],
    ['a label with a space at the end', { label: 'Casa ' }],
    ['a location with -0 and an extra nested key', { location: { lat: -0, lng: 0, z: {} } }],
  ])('blocks an address with %s', async (_case, change) => {
    await seedDoc(env, `users/${CUSTOMER_UID}/addresses/a0`, addressDoc(old));
    await assertFails(setDoc(address('a1'), addressDoc(change)));
    await assertFails(updateDoc(address('a0'), { ...change, ...stamp }));
  });

  it.each(['a10', 'a-1', 'A0', 'a', 'a٣', 'a0 ', 'a0\n', 'b0', '0', 'aa'])(
    'blocks the address slot "%s"',
    async (slot) => {
      await assertFails(setDoc(address(slot), addressDoc()));
    },
  );

  it('blocks listing or counting addresses without the cap', async () => {
    const db = verified(env, CUSTOMER_UID);
    const all = collection(db, `users/${CUSTOMER_UID}/addresses`);
    await assertFails(getDocs(all));
    await assertFails(getDocs(query(all, limit(MAX_ADDRESSES_PER_USER + 1))));
    await assertFails(getCountFromServer(all));
    await assertSucceeds(getDocs(query(all, limit(MAX_ADDRESSES_PER_USER))));
  });

  it('blocks storing an address for an account that never accepted the terms (no profile)', async () => {
    const db = verified(env, 'no-profile');
    const first = doc(db, 'users/no-profile/addresses/a0');
    await assertFails(setDoc(first, addressDoc()));
    await assertFails(setDoc(first, addressDoc(), { merge: true }));

    await assertSucceeds(setDoc(doc(db, 'users/no-profile'), userDoc()));
    await assertSucceeds(setDoc(first, addressDoc()));
  });
});

describe('staff and owner data — junk an owner writes about others', () => {
  it.each([
    ['a blank name', { displayName: '   ' }],
    ['a name with a line break at the end', { displayName: 'D. Persona\n' }],
    ['active as text', { active: 'true' }],
    ['active as null', { active: null }],
    ['a role in upper case', { role: 'OWNER' }],
    ['a role with a space', { role: 'owner ' }],
    ['a role as a list', { role: ['owner'] }],
  ])('blocks the owner from giving a member %s', async (_case, change) => {
    const target = doc(verified(env, 'owner-a'), `distributors/${WORLD.a.d}/members/driver-a`);
    await assertFails(updateDoc(target, { ...change, ...stamp }));
  });

  it.each([
    ['a blank owner name', { ownerName: '  ' }],
    ['an owner phone with a line break', { ownerPhone: '900000002\n' }],
  ])('blocks the founder from writing %s in the private settings', async (_case, change) => {
    const settings = doc(verified(env, 'owner-a'), `distributors/${WORLD.a.d}/private/settings`);
    await assertFails(updateDoc(settings, { ...change, ...stamp }));
    await assertFails(
      foundDistributor(verified(env, FOUNDER), { ...NEW, settings: privateDoc(FOUNDER, change) }),
    );
  });

  it('blocks the founder from editing the private settings without the server time', async () => {
    const settings = doc(verified(env, 'owner-a'), `distributors/${WORLD.a.d}/private/settings`);
    const FUTURE = Timestamp.fromDate(new Date('2099-01-01T00:00:00Z'));

    await assertFails(updateDoc(settings, { ownerName: 'A. Nueva' }));
    await assertFails(updateDoc(settings, { ownerName: 'A. Nueva', updatedAt: PAST }));
    await assertFails(updateDoc(settings, { ownerName: 'A. Nueva', updatedAt: FUTURE }));
    await assertSucceeds(updateDoc(settings, { ownerName: 'A. Nueva', ...stamp }));
  });
});
