import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
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
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DISTRIBUTOR_SEARCH_LIMIT,
  MAX_BRANDS,
  MAX_DISTRIBUTORS_PER_ACCOUNT,
  MAX_PRICE_CENTS,
  TRIAL_DAYS,
} from '../../src/domain/tenancy/constants';
import { EDITABLE_PROFILE_FIELDS } from '../../src/domain/tenancy/distributor-input';
import { RESERVED_SLUGS } from '../../src/domain/tenancy/slug';
import { isWritable } from '../../src/domain/tenancy/status';
import { VISIBLE_DISTRIBUTOR_STATUSES } from '../../src/domain/tenancy/types';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  daysFromNow,
  distributorDoc,
  foundDistributor,
  type FoundingOptions,
  memberDoc,
  privateDoc,
  seedDoc,
  seedProfile,
  seedWorld,
  slugDoc,
  unverified,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const FOUNDER = 'founder';
const NEW = { d: 'dist-new', uid: FOUNDER, slug: 'gas-nuevo' } satisfies FoundingOptions;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };

beforeAll(async () => {
  env = await createEnv('distributors');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedProfile(env, FOUNDER);
});

afterAll(async () => {
  await env.cleanup();
});

describe('founding a distributor (PLAN 2.2)', () => {
  it('lets a verified account found one with the full batch', async () => {
    await assertSucceeds(foundDistributor(verified(env, FOUNDER), NEW));
  });

  it('leaves the founder as owner, on trial, with the slug pointing at it', async () => {
    const db = verified(env, FOUNDER);
    await foundDistributor(db, NEW);

    const distributor = (await getDoc(doc(db, `distributors/${NEW.d}`))).data();
    const member = (await getDoc(doc(db, `distributors/${NEW.d}/members/${FOUNDER}`))).data();
    const slug = (await getDoc(doc(db, `slugs/${NEW.slug}`))).data();
    const profile = (await getDoc(doc(db, `users/${FOUNDER}`))).data();
    expect(distributor?.status).toBe('trial');
    expect(distributor?.ownerUid).toBe(FOUNDER);
    expect(member?.role).toBe('owner');
    expect(slug?.distributorId).toBe(NEW.d);
    expect(profile?.ownedDistributorIds).toEqual([NEW.d]);
  });

  it('blocks an account whose e-mail is not verified', async () => {
    await assertFails(foundDistributor(unverified(env, FOUNDER), NEW));
  });

  it('blocks an anonymous visitor', async () => {
    await assertFails(foundDistributor(anonymous(env), NEW));
  });

  it('blocks an account without a profile', async () => {
    await assertFails(foundDistributor(verified(env, 'no-profile'), { ...NEW, uid: 'no-profile' }));
    await assertFails(
      foundDistributor(verified(env, 'no-profile'), {
        ...NEW,
        uid: 'no-profile',
        userUpdate: false,
      }),
    );
  });

  it.each<[string, Partial<FoundingOptions>]>([
    ['without the slug document', { slugData: null }],
    ['without the owner member', { member: null }],
    ['without the private settings', { settings: null }],
    ['without recording it in the founder profile', { userUpdate: false }],
    ['without the distributor itself', { distributor: null }],
  ])('blocks a batch %s', async (_case, change) => {
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, ...change }));
  });

  it('blocks taking the slug of another distributor', async () => {
    const db = verified(env, FOUNDER);
    await assertFails(foundDistributor(db, { ...NEW, slug: WORLD.a.slug }));
  });

  it('blocks a second distributor with the same slug', async () => {
    await seedProfile(env, 'second');
    await foundDistributor(verified(env, FOUNDER), NEW);

    const duplicate = { d: 'dist-copy', uid: 'second', slug: NEW.slug };
    await assertFails(foundDistributor(verified(env, 'second'), duplicate));
  });

  it('blocks a slug document that does not match the distributor', async () => {
    const db = verified(env, FOUNDER);
    await assertFails(foundDistributor(db, { ...NEW, slugId: 'otro-enlace' }));
    await assertFails(foundDistributor(db, { ...NEW, slugData: slugDoc(WORLD.a.d) }));
    await assertFails(foundDistributor(db, { ...NEW, slugData: slugDoc('dist-ghost') }));
  });

  it.each([...RESERVED_SLUGS])('blocks the reserved slug "%s"', async (slug) => {
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, slug }));
  });

  it.each(['ab', 'Gas-Nuevo', 'gas_nuevo', 'gas--nuevo', '-gas', 'gas-', 'gás', 'g'.repeat(41)])(
    'blocks the malformed slug "%s"',
    async (slug) => {
      await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, slug }));
    },
  );

  it.each([
    ['already active', { status: 'active' }],
    ['suspended', { status: 'suspended' }],
    ['with an unknown status', { status: 'vip' }],
    ['with a 60-day trial', { trialEndsAt: daysFromNow(60) }],
    ['with a trial two hours too long', { trialEndsAt: daysFromNow(TRIAL_DAYS + 2 / 24) }],
    ['with a trial far in the future', { trialEndsAt: daysFromNow(36_500) }],
    ['with a one-day trial', { trialEndsAt: daysFromNow(1) }],
    ['with a trial that already ended', { trialEndsAt: PAST }],
    ['with trialEndsAt as text', { trialEndsAt: '2099-01-01' }],
    ['owned by someone else', { ownerUid: 'owner-a' }],
    ['with a made-up createdAt', { createdAt: PAST }],
    ['with a made-up updatedAt', { updatedAt: PAST }],
    ['with brands before having a catalogue', { brands: ['Marca Uno'] }],
    ['with a price before having a catalogue', { priceFromCents: 3800 }],
    ['with another currency', { currency: 'USD' }],
    ['with an extra field', { verifiedByPlatform: true }],
    ['with a plan field', { plan: 'pro' }],
  ])('blocks founding one %s', async (_case, change) => {
    const distributor = distributorDoc(FOUNDER, NEW.slug, change);
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, distributor }));
  });

  it.each([
    'name',
    'slug',
    'ownerUid',
    'contactPhone',
    'whatsapp',
    'addressLine',
    'plant',
    'coverageRadiusKm',
    'brandColor',
    'status',
    'trialEndsAt',
    'schedule',
    'maxCylindersPerOrder',
    'brands',
    'priceFromCents',
    'currency',
    'createdAt',
    'updatedAt',
  ])('blocks founding one without %s', async (field) => {
    const { [field]: _dropped, ...distributor } = distributorDoc(FOUNDER, NEW.slug) as Record<
      string,
      unknown
    >;
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, distributor }));
  });

  it.each([
    ['member with another role', { member: memberDoc(NEW.d, FOUNDER, 'dispatcher') }],
    ['inactive owner member', { member: memberDoc(NEW.d, FOUNDER, 'owner', { active: false }) }],
    ['member with an extra field', { member: memberDoc(NEW.d, FOUNDER, 'owner', { admin: true }) }],
    ['member for another distributor', { member: memberDoc(WORLD.a.d, FOUNDER, 'owner') }],
    [
      'member with a made-up createdAt',
      { member: memberDoc(NEW.d, FOUNDER, 'owner', { createdAt: PAST }) },
    ],
    ['settings owned by someone else', { settings: privateDoc('owner-a') }],
    ['settings with a paid plan', { settings: privateDoc(FOUNDER, { plan: 'pro' }) }],
    [
      'settings with a foreign e-mail',
      { settings: privateDoc(FOUNDER, { ownerEmail: 'x@example.com' }) },
    ],
    ['settings with an extra field', { settings: privateDoc(FOUNDER, { discount: 100 }) }],
    ['settings with an invalid phone', { settings: privateDoc(FOUNDER, { ownerPhone: '123' }) }],
    ['slug with an extra field', { slugData: slugDoc(NEW.d, { premium: true }) }],
    ['slug with a made-up createdAt', { slugData: slugDoc(NEW.d, { createdAt: PAST }) }],
    [
      'profile claiming two distributors',
      { userUpdate: { ownedDistributorIds: [NEW.d, WORLD.a.d], ...stamp } },
    ],
    [
      'profile claiming another distributor',
      { userUpdate: { ownedDistributorIds: [WORLD.a.d], ...stamp } },
    ],
  ] as [string, Partial<FoundingOptions>][])('blocks a batch with a %s', async (_case, change) => {
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, ...change }));
  });

  it('blocks founding under an id that is not a plain document id', async () => {
    const db = verified(env, FOUNDER);
    await assertFails(foundDistributor(db, { ...NEW, d: 'dist new' }));
    await assertFails(foundDistributor(db, { ...NEW, d: 'd'.repeat(65) }));
  });

  it('caps how many distributors one account can found', async () => {
    const db = verified(env, FOUNDER);
    for (let index = 0; index < MAX_DISTRIBUTORS_PER_ACCOUNT; index += 1) {
      await assertSucceeds(
        foundDistributor(db, { d: `dist-n${index}`, uid: FOUNDER, slug: `gas-n${index}` }),
      );
    }
    await assertFails(foundDistributor(db, { d: 'dist-extra', uid: FOUNDER, slug: 'gas-extra' }));
  });

  it('blocks overwriting an existing distributor through the founding batch', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(
      foundDistributor(db, { d: WORLD.a.d, uid: 'owner-a', slug: WORLD.a.slug, userUpdate: false }),
    );
    await assertFails(foundDistributor(db, { d: WORLD.a.d, uid: 'owner-a', slug: 'gas-otro' }));
  });
});

describe('field validation, on founding and on editing', () => {
  const INVALID: [string, Record<string, unknown>][] = [
    ['numeric name', { name: 7 }],
    ['one-letter name', { name: 'G' }],
    ['oversized name', { name: 'G'.repeat(61) }],
    ['megabyte name', { name: 'G'.repeat(900_000) }],
    ['landline contact phone', { contactPhone: '012345678' }],
    ['numeric contact phone', { contactPhone: 900000001 }],
    ['WhatsApp with prefix', { whatsapp: '+51900000001' }],
    ['oversized address line', { addressLine: 'a'.repeat(161) }],
    ['numeric address line', { addressLine: 1 }],
    ['plant off the globe', { plant: { lat: 91, lng: 0 } }],
    ['plant with text coordinates', { plant: { lat: '-12', lng: '-77' } }],
    ['plant with an extra key', { plant: { lat: 0, lng: 0, owner: 'x' } }],
    ['plant without lng', { plant: { lat: 0 } }],
    ['plant as null', { plant: null }],
    ['zero coverage radius', { coverageRadiusKm: 0 }],
    ['negative coverage radius', { coverageRadiusKm: -5 }],
    ['country-wide coverage radius', { coverageRadiusKm: 5000 }],
    ['coverage radius as text', { coverageRadiusKm: '5' }],
    ['brand colour without hash', { brandColor: 'd9480f' }],
    ['uppercase brand colour', { brandColor: '#D9480F' }],
    ['brand colour as CSS injection', { brandColor: 'red;background:url(//x)' }],
    ['schedule as text', { schedule: 'siempre' }],
    ['schedule without days', { schedule: { days: [], opensAt: '07:00', closesAt: '20:00' } }],
    ['schedule with day 7', { schedule: { days: [7], opensAt: '07:00', closesAt: '20:00' } }],
    [
      'schedule with too many days',
      { schedule: { days: [0, 1, 2, 3, 4, 5, 6, 0], opensAt: '07:00', closesAt: '20:00' } },
    ],
    ['schedule with a bad time', { schedule: { days: [1], opensAt: '7am', closesAt: '20:00' } }],
    ['schedule with hour 24', { schedule: { days: [1], opensAt: '07:00', closesAt: '24:00' } }],
    [
      'schedule with an extra key',
      { schedule: { days: [1], opensAt: '07:00', closesAt: '20:00', note: 'x' } },
    ],
    ['zero cylinders per order', { maxCylindersPerOrder: 0 }],
    ['too many cylinders per order', { maxCylindersPerOrder: 21 }],
    ['fractional cylinders per order', { maxCylindersPerOrder: 2.5 }],
  ];

  it.each(INVALID)('blocks founding with %s', async (_case, change) => {
    const distributor = distributorDoc(FOUNDER, NEW.slug, change);
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, distributor }));
  });

  it.each([
    ...INVALID,
    ['too many brands', { brands: Array.from({ length: MAX_BRANDS + 1 }, (_, i) => `M${i}`) }],
    ['a numeric brand', { brands: ['Marca Uno', 7] }],
    ['an empty brand', { brands: [''] }],
    ['an oversized brand', { brands: ['m'.repeat(31)] }],
    [
      'an oversized last brand',
      { brands: [...Array<string>(MAX_BRANDS - 1).fill('M'), 'm'.repeat(31)] },
    ],
    ['brands as text', { brands: 'Marca Uno' }],
    ['a float price', { priceFromCents: 38.5 }],
    ['a zero price', { priceFromCents: 0 }],
    ['a negative price', { priceFromCents: -100 }],
    ['an absurd price', { priceFromCents: MAX_PRICE_CENTS + 1 }],
    ['a text price', { priceFromCents: '3800' }],
  ] as [string, Record<string, unknown>][])(
    'blocks an owner edit with %s',
    async (_case, change) => {
      const db = verified(env, 'owner-a');
      await assertFails(updateDoc(doc(db, `distributors/${WORLD.a.d}`), { ...change, ...stamp }));
    },
  );
});

describe('/distributors/{d} — public read', () => {
  const visible = where('status', 'in', [...VISIBLE_DISTRIBUTOR_STATUSES]);

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['a member of another distributor', () => verified(env, 'driver-b')],
  ])('lets %s read one distributor, whatever its status', async (_who, connect) => {
    const db = connect();
    await assertSucceeds(getDoc(doc(db, `distributors/${WORLD.a.d}`)));
    await assertSucceeds(getDoc(doc(db, `distributors/${WORLD.suspended.d}`)));
  });

  it('lets anyone list visible distributors with a bounded query', async () => {
    const all = collection(anonymous(env), 'distributors');
    const result = await assertSucceeds(
      getDocs(query(all, visible, limit(DISTRIBUTOR_SEARCH_LIMIT))),
    );
    const ids = result.docs.map((snapshot) => snapshot.id).sort();
    expect(ids).toEqual([WORLD.a.d, WORLD.b.d, WORLD.expired.d, WORLD.trial.d].sort());
  });

  it.each([
    ['without a limit', () => [visible]],
    ['with a limit above the cap', () => [visible, limit(DISTRIBUTOR_SEARCH_LIMIT + 1)]],
    ['without a status filter', () => [limit(10)]],
    ['filtered to suspended', () => [where('status', '==', 'suspended'), limit(10)]],
    ['filtered to past due', () => [where('status', '==', 'pastDue'), limit(10)]],
    [
      'with a status list that includes suspended',
      () => [where('status', 'in', ['trial', 'active', 'suspended']), limit(10)],
    ],
    ['filtered by owner only', () => [where('ownerUid', '==', 'owner-a'), limit(10)]],
  ])('blocks a public list %s', async (_case, constraints) => {
    const all = collection(verified(env, CUSTOMER_UID), 'distributors');
    await assertFails(getDocs(query(all, ...constraints())));
  });

  it('holds nothing private in the public document', async () => {
    const snapshot = await getDoc(doc(anonymous(env), `distributors/${WORLD.a.d}`));
    const leaked = Object.keys(snapshot.data() ?? {}).filter((key) =>
      ['ownerName', 'ownerPhone', 'ownerEmail', 'plan', 'notes'].includes(key),
    );
    expect(leaked).toEqual([]);
  });
});

describe('/distributors/{d} — owner edit', () => {
  const target = (uid: string, d = WORLD.a.d) => doc(verified(env, uid), `distributors/${d}`);
  const EDIT: Record<(typeof EDITABLE_PROFILE_FIELDS)[number], unknown> = {
    name: 'Gas Demo Renombrado',
    contactPhone: '900000021',
    whatsapp: '900000022',
    addressLine: 'Jr. Nuevo 200',
    plant: { lat: -12.05, lng: -77.05 },
    coverageRadiusKm: 7.5,
    brandColor: '#0a7cff',
    schedule: { days: [1, 2, 3, 4, 5], opensAt: '08:00', closesAt: '18:30' },
    maxCylindersPerOrder: 5,
    brands: ['Marca Uno', 'Marca Dos'],
    priceFromCents: 3800,
  };

  it.each(EDITABLE_PROFILE_FIELDS)('lets the owner edit %s', async (field) => {
    await assertSucceeds(updateDoc(target('owner-a'), { [field]: EDIT[field], ...stamp }));
  });

  it('lets the owner edit the whole profile at once and clear the price', async () => {
    await assertSucceeds(updateDoc(target('owner-a'), { ...EDIT, ...stamp }));
    await assertSucceeds(
      updateDoc(target('owner-a'), { priceFromCents: null, brands: [], ...stamp }),
    );
  });

  it('lets the owner of a running trial edit', async () => {
    const trialOwner = target('owner-trial', WORLD.trial.d);
    await assertSucceeds(updateDoc(trialOwner, { name: 'Gas Demo En Prueba', ...stamp }));
  });

  it.each([
    ['its status to suspended', { status: 'suspended' }],
    ['its status to past due', { status: 'pastDue' }],
    ['its status to trial', { status: 'trial' }],
    ['its trial end', { trialEndsAt: daysFromNow(3650) }],
    ['its slug', { slug: 'gas-otro' }],
    ['its founder', { ownerUid: 'dispatcher-a' }],
    ['its createdAt', { createdAt: serverTimestamp() }],
    ['its currency', { currency: 'USD' }],
    ['an extra field', { featured: true }],
  ])('blocks the owner from changing %s', async (_case, change) => {
    await assertFails(updateDoc(target('owner-a'), { ...change, ...stamp }));
  });

  it('blocks an edit without a fresh updatedAt', async () => {
    await assertFails(updateDoc(target('owner-a'), { name: 'Gas Demo Dos' }));
    await assertFails(updateDoc(target('owner-a'), { name: 'Gas Demo Dos', updatedAt: PAST }));
  });

  it('blocks replacing the document with one that drops required fields', async () => {
    await assertFails(setDoc(target('owner-a'), { name: 'Gas Demo', ...stamp }));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['an unverified stranger', () => unverified(env, 'stranger')],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['its dispatcher', () => verified(env, 'dispatcher-a')],
    ['its driver', () => verified(env, 'driver-a')],
    ['the owner of another distributor', () => verified(env, 'owner-b')],
    ['a member of another distributor', () => verified(env, 'driver-b')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('blocks %s from editing the profile', async (_who, connect) => {
    const db = connect();
    await assertFails(
      updateDoc(doc(db, `distributors/${WORLD.a.d}`), { name: 'Hackeado', ...stamp }),
    );
  });

  it('blocks an owner who was deactivated', async () => {
    const path = `distributors/${WORLD.a.d}/members/owner-a`;
    await seedDoc(
      env,
      path,
      memberDoc(WORLD.a.d, 'owner-a', 'owner', { active: false, createdAt: PAST, updatedAt: PAST }),
    );
    await assertFails(updateDoc(target('owner-a'), { name: 'Gas Demo Dos', ...stamp }));
  });

  it.each([
    ['suspended', WORLD.suspended, 'owner-suspended'],
    ['on an expired trial', WORLD.expired, 'owner-expired'],
    ['past due', WORLD.pastDue, 'owner-past-due'],
  ] as const)('blocks the owner of a distributor that is %s', async (_case, seeded, owner) => {
    await assertFails(updateDoc(target(owner, seeded.d), { name: 'Gas Demo Dos', ...stamp }));
  });

  it.each(Object.values(WORLD))('agrees with the domain isWritable for $d', async (seeded) => {
    const owner = Object.keys(seeded.members)[0] ?? '';
    const expected = isWritable(
      { status: seeded.status, trialEndsAt: seeded.trialEndsAt.toDate() },
      new Date(),
    );

    const attempt = updateDoc(target(owner, seeded.d), { name: 'Gas Demo Dos', ...stamp });
    const passed = await attempt.then(
      () => true,
      () => false,
    );

    expect(passed).toBe(expected);
  });

  it('blocks deleting a distributor, for everyone', async () => {
    await assertFails(deleteDoc(target('owner-a')));
    await assertFails(deleteDoc(target(ADMIN_UID)));
  });
});

describe('/distributors/{d} — platform admin', () => {
  const asAdmin = (d: string) => doc(verified(env, ADMIN_UID), `distributors/${d}`);

  it.each(['suspended', 'active', 'pastDue', 'trial'])(
    'lets the admin set status %s',
    async (status) => {
      await assertSucceeds(updateDoc(asAdmin(WORLD.a.d), { status, ...stamp }));
    },
  );

  it('lets the admin lift a suspension', async () => {
    await assertSucceeds(updateDoc(asAdmin(WORLD.suspended.d), { status: 'active', ...stamp }));
  });

  it.each([
    ['an unknown status', { status: 'banned' }],
    ['the name', { status: 'suspended', name: 'Cambiado' }],
    ['the founder', { ownerUid: ADMIN_UID }],
    ['the slug', { slug: 'gas-otro' }],
    ['the trial end', { trialEndsAt: daysFromNow(365) }],
  ])('blocks the admin from changing %s', async (_case, change) => {
    await assertFails(updateDoc(asAdmin(WORLD.a.d), { ...change, ...stamp }));
  });

  it('blocks someone who only claims to be admin in the token', async () => {
    const fake = env.authenticatedContext('pretender', {
      admin: true,
      platformAdmin: true,
      role: 'admin',
      email_verified: true,
    });
    const target = doc(fake.firestore(), `distributors/${WORLD.a.d}`);
    await assertFails(updateDoc(target, { status: 'suspended', ...stamp }));
  });
});

describe('/slugs/{slug}', () => {
  it('lets anyone resolve one slug', async () => {
    await assertSucceeds(getDoc(doc(anonymous(env), `slugs/${WORLD.a.slug}`)));
  });

  it('blocks listing slugs', async () => {
    await assertFails(getDocs(query(collection(anonymous(env), 'slugs'), limit(1))));
    await assertFails(getDocs(query(collection(verified(env, 'owner-a'), 'slugs'), limit(1))));
  });

  it.each([
    ['pointing at its own distributor', 'owner-a', WORLD.a.d],
    ['pointing at a distributor of someone else', 'owner-b', WORLD.a.d],
    ['pointing at nothing', CUSTOMER_UID, 'dist-ghost'],
  ])('blocks reserving a slug outside the founding batch, %s', async (_case, uid, d) => {
    await assertFails(setDoc(doc(verified(env, uid), 'slugs/gas-acaparado'), slugDoc(d)));
  });

  it.each([
    ['its owner', 'owner-a'],
    ['another owner', 'owner-b'],
    ['a platform admin', ADMIN_UID],
  ])('blocks %s from repointing or deleting a slug', async (_who, uid) => {
    const slug = doc(verified(env, uid), `slugs/${WORLD.a.slug}`);
    await assertFails(updateDoc(slug, { distributorId: WORLD.b.d }));
    await assertFails(setDoc(slug, slugDoc(WORLD.a.d)));
    await assertFails(deleteDoc(slug));
  });
  it('blocks claiming the slug of a distributor that was left without its slug document', async () => {
    // Inconsistent data that only an admin script could leave behind.
    const orphan = distributorDoc('owner-a', 'gas-huerfano', { createdAt: PAST, updatedAt: PAST });
    await seedDoc(env, 'distributors/dist-orphan', orphan);

    for (const uid of [CUSTOMER_UID, 'owner-b', 'owner-a']) {
      const claim = setDoc(doc(verified(env, uid), 'slugs/gas-huerfano'), slugDoc('dist-orphan'));
      await assertFails(claim);
    }
  });
});

describe('/distributors/{d}/private/settings', () => {
  const settings = (db: ReturnType<typeof anonymous>, d = WORLD.a.d) =>
    doc(db, `distributors/${d}/private/settings`);

  it('lets the founder and a platform admin read it', async () => {
    await assertSucceeds(getDoc(settings(verified(env, 'owner-a'))));
    await assertSucceeds(getDoc(settings(verified(env, ADMIN_UID))));
  });

  it('lets a co-owner read it', async () => {
    const path = `distributors/${WORLD.a.d}/members/co-owner`;
    await seedDoc(
      env,
      path,
      memberDoc(WORLD.a.d, 'co-owner', 'owner', { createdAt: PAST, updatedAt: PAST }),
    );
    await assertSucceeds(getDoc(settings(verified(env, 'co-owner'))));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['its dispatcher', () => verified(env, 'dispatcher-a')],
    ['its driver', () => verified(env, 'driver-a')],
    ['the owner of another distributor', () => verified(env, 'owner-b')],
  ])('blocks %s from reading or editing it', async (_who, connect) => {
    const db = connect();
    await assertFails(getDoc(settings(db)));
    await assertFails(updateDoc(settings(db), { ownerName: 'X', ...stamp }));
    await assertFails(
      getDocs(query(collection(db, `distributors/${WORLD.a.d}/private`), limit(1))),
    );
  });

  it('lets the founder edit the owner contact data', async () => {
    const own = settings(verified(env, 'owner-a'));
    await assertSucceeds(
      updateDoc(own, { ownerName: 'A. Nueva', ownerPhone: '900000031', ...stamp }),
    );
  });

  it.each([
    ['the plan', { plan: 'pro' }],
    ['the founder', { ownerUid: 'dispatcher-a' }],
    ['the e-mail', { ownerEmail: 'otro@example.com' }],
    ['createdAt', { createdAt: serverTimestamp() }],
    ['an extra field', { credits: 100 }],
    ['an invalid phone', { ownerPhone: '123' }],
    ['an oversized name', { ownerName: 'n'.repeat(81) }],
  ])('blocks the founder from changing %s', async (_case, change) => {
    await assertFails(updateDoc(settings(verified(env, 'owner-a')), { ...change, ...stamp }));
  });

  it('blocks the founder of a suspended distributor from editing, but not from reading', async () => {
    const own = settings(verified(env, 'owner-suspended'), WORLD.suspended.d);
    await assertSucceeds(getDoc(own));
    await assertFails(updateDoc(own, { ownerName: 'A. Nueva', ...stamp }));
  });

  it('blocks creating settings or any sibling document outside the founding batch', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(
      setDoc(doc(db, `distributors/${WORLD.a.d}/private/other`), privateDoc('owner-a')),
    );
    await assertFails(
      setDoc(settings(verified(env, CUSTOMER_UID), 'dist-ghost'), privateDoc(CUSTOMER_UID)),
    );
    await assertFails(deleteDoc(settings(db)));
  });
});
