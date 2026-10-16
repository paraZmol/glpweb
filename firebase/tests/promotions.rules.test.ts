// PLAN 3.5: the promotions of each distributor, /distributors/{d}/promotions/{slot} (§11,
// 2026-10-16). The price lock they put on products is in promotion-price-lock.rules.test.ts.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
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
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_PERCENT_OFF,
  MAX_PROMOTION_DAYS,
  MAX_SCHEDULE_AHEAD_DAYS,
  MAX_TOTAL_UNITS,
  MAX_UNITS_PER_ORDER,
  PROMOTION_CONDITIONS_MAX_LENGTH,
  PROMOTION_TITLE_MAX_LENGTH,
  PROMOTIONS_QUERY_LIMIT,
} from '../../src/domain/pricing/constants';
import { PROMOTION_SLOT_IDS } from '../../src/domain/pricing/promotion';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  daysFromNow,
  memberDoc,
  promotionDoc,
  promotionPath,
  seedDoc,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const MS_PER_DAY = 86_400_000;
// Margin of the dates computed when the tables load, long before the test that uses them runs.
const HOUR = 3_600_000;
const AT = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const ago = (ms: number) => Timestamp.fromMillis(Date.now() - ms);
const ahead = (ms: number) => Timestamp.fromMillis(Date.now() + ms);
const stamp = { updatedAt: serverTimestamp() };

/** A promotion as it is stored: started a day ago, ends in six days. */
const stored = (change: Record<string, unknown> = {}) =>
  promotionDoc({
    startsAt: ago(MS_PER_DAY),
    endsAt: daysFromNow(6),
    createdAt: AT,
    updatedAt: AT,
    ...change,
  });

// The parameters of each kind, on top of the P1 of promotionDoc().
const PERCENT = { type: 'percentOff', priceSource: undefined, priceCents: undefined, percent: 10 };
const AMOUNT = {
  type: 'amountOff',
  priceSource: undefined,
  priceCents: undefined,
  amountCents: 500,
};
const GAS_PRICE = {
  priceSource: 'refill',
  priceCents: null,
  saleMode: 'full',
  maxUnitsPerOrder: 1,
  totalUnits: 20,
};
const TWO_FOR_ONE = {
  type: 'buyXPayY',
  priceSource: undefined,
  priceCents: undefined,
  buyUnits: 2,
  payUnits: 1,
  totalUnits: 50,
};

const promotionOf = (db: Db, d: string, slot: string) => doc(db, promotionPath(d, slot));
const promotionsOf = (db: Db, d: string) => collection(db, `distributors/${d}/promotions`);
const published = (db: Db, d: string, max = PROMOTIONS_QUERY_LIMIT) =>
  query(promotionsOf(db, d), where('active', '==', true), limit(max));
const allSlots = (db: Db, d: string, max = PROMOTIONS_QUERY_LIMIT) =>
  query(promotionsOf(db, d), limit(max));

/** Every seeded distributor gets one published promotion (o00) and one unpublished (o01). */
async function seedPromotions() {
  for (const { d } of Object.values(WORLD)) {
    await seedDoc(env, promotionPath(d, 'o00'), stored());
    await seedDoc(env, promotionPath(d, 'o01'), stored({ active: false }));
  }
}

beforeAll(async () => {
  env = await createEnv('promotions');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedPromotions();
});

afterAll(async () => {
  await env.cleanup();
});

const STAFF_OF_A = ['owner-a', 'dispatcher-a', 'driver-a'];
const NOT_STAFF_OF_A = ['owner-b', 'dispatcher-b', 'driver-b', CUSTOMER_UID, ADMIN_UID];

describe('promotions — what anybody reads (marketing D13)', () => {
  it('lets a visitor list the published promotions of a distributor that takes orders', async () => {
    const list = await assertSucceeds(getDocs(published(anonymous(env), A)));
    expect(list.docs.map((promotion) => promotion.id)).toEqual(['o00']);
  });

  it('lets a visitor ask only for those that have not ended (the query of the app)', async () => {
    const live = query(
      promotionsOf(anonymous(env), A),
      where('active', '==', true),
      where('endsAt', '>', Timestamp.now()),
      limit(PROMOTIONS_QUERY_LIMIT),
    );
    await assertSucceeds(getDocs(live));
  });

  it.each([CUSTOMER_UID, 'owner-b', ADMIN_UID])(
    'lets %s list them like any visitor',
    async (uid) => {
      await assertSucceeds(getDocs(published(verified(env, uid), A)));
    },
  );

  it('lets a visitor read one published promotion', async () => {
    await assertSucceeds(getDoc(promotionOf(anonymous(env), A, 'o00')));
  });

  it('blocks a visitor from one saved without publishing', async () => {
    await assertFails(getDoc(promotionOf(anonymous(env), A, 'o01')));
  });

  it('blocks a visitor query that does not ask only for published ones', async () => {
    await assertFails(getDocs(allSlots(anonymous(env), A)));
  });

  it('blocks a query above the limit, or without one', async () => {
    const db = anonymous(env);
    await assertFails(getDocs(published(db, A, PROMOTIONS_QUERY_LIMIT + 1)));
    await assertFails(getDocs(query(promotionsOf(db, A), where('active', '==', true))));
  });

  it.each([
    ['waits for its review', WORLD.pending.d],
    ['is suspended', WORLD.suspended.d],
    ['has its trial over', WORLD.expired.d],
    ['has its payment pending', WORLD.pastDue.d],
  ])('hides from visitors the promotions of one that %s', async (_case, d) => {
    await assertFails(getDocs(published(anonymous(env), d)));
    await assertFails(getDoc(promotionOf(anonymous(env), d, 'o00')));
  });
});

describe('promotions — what the staff reads', () => {
  it.each(STAFF_OF_A)('lets %s list every slot, unpublished included', async (uid) => {
    const list = await assertSucceeds(getDocs(allSlots(verified(env, uid), A)));
    expect(list.size).toBe(2);
  });

  it.each(STAFF_OF_A)('lets %s read one saved without publishing', async (uid) => {
    await assertSucceeds(getDoc(promotionOf(verified(env, uid), A, 'o01')));
  });

  it.each(NOT_STAFF_OF_A)('blocks %s from every slot of A', async (uid) => {
    await assertFails(getDocs(allSlots(verified(env, uid), A)));
    await assertFails(getDoc(promotionOf(verified(env, uid), A, 'o01')));
  });

  it('blocks a member that was deactivated', async () => {
    await seedDoc(
      env,
      `distributors/${A}/members/driver-a`,
      memberDoc(A, 'driver-a', 'driver', { active: false, createdAt: AT, updatedAt: AT }),
    );
    await assertFails(getDocs(allSlots(verified(env, 'driver-a'), A)));
  });

  it('lets the staff of a suspended distributor read its own', async () => {
    await assertSucceeds(getDocs(allSlots(verified(env, 'driver-suspended'), WORLD.suspended.d)));
  });

  it('blocks a staff query above the limit', async () => {
    await assertFails(getDocs(allSlots(verified(env, 'owner-a'), A, PROMOTIONS_QUERY_LIMIT + 1)));
  });
});

const add = (uid: string, change: Record<string, unknown> = {}, d = A, slot = 'o02') =>
  setDoc(promotionOf(verified(env, uid), d, slot), promotionDoc({ createdBy: uid, ...change }));

describe('promotions — who adds one', () => {
  it.each([
    ['P1, a special price', {}],
    ['P2, a percentage on several products', { ...PERCENT, productIds: ['p00', 'p01', 'p02'] }],
    ['P3, the full cylinder at the price of gas', GAS_PRICE],
    [
      'P4, a full cylinder with a discount',
      { saleMode: 'full', priceCents: 16900, maxUnitsPerOrder: 1 },
    ],
    ['P5, "lleva 2, paga 1"', TWO_FOR_ONE],
    [
      'P5, "lleva 3, paga 2" twice per order',
      { ...TWO_FOR_ONE, buyUnits: 3, payUnits: 2, maxUnitsPerOrder: 6 },
    ],
    ['"S/ 5 menos" on every product', { ...AMOUNT, productIds: ['p00', 'p01'] }],
    ['one saved without publishing', { active: false }],
    ['one scheduled for tomorrow', { startsAt: daysFromNow(1), endsAt: daysFromNow(2) }],
  ])('lets the owner add %s', async (_case, change) => {
    await assertSucceeds(add('owner-a', change));
  });

  it('lets the owner of a listing waiting for review prepare one', async () => {
    await assertSucceeds(add('owner-pending', {}, WORLD.pending.d));
  });

  // PLAN §11, 2026-10-16 (decision of the user): the owner and the dispatcher, as with prices.
  it('lets the dispatcher add one', async () => {
    await assertSucceeds(add('dispatcher-a'));
  });

  it.each(['driver-a', 'owner-b', 'dispatcher-b', CUSTOMER_UID, ADMIN_UID])(
    'blocks %s from adding one to A',
    async (uid) => {
      await assertFails(add(uid));
    },
  );

  it('blocks a visitor', async () => {
    await assertFails(setDoc(promotionOf(anonymous(env), A, 'o02'), promotionDoc()));
  });

  it.each([
    ['suspended', 'owner-suspended', WORLD.suspended.d],
    ['with its trial over', 'owner-expired', WORLD.expired.d],
    ['with its payment pending', 'owner-past-due', WORLD.pastDue.d],
  ])('blocks the owner of a distributor %s', async (_case, uid, d) => {
    await assertFails(add(uid, {}, d));
  });

  it('blocks the owner of A from writing in B', async () => {
    await assertFails(add('owner-a', {}, B));
  });

  it.each(['o20', 'o0', 'o000', 'O02', 'p00', 'promo', 'o-1'])(
    'blocks a promotion outside the slots (%s)',
    async (slot) => {
      await assertFails(add('owner-a', {}, A, slot));
    },
  );

  it('accepts the last slot', async () => {
    await assertSucceeds(add('owner-a', {}, A, PROMOTION_SLOT_IDS.at(-1) ?? ''));
  });

  it('blocks writing over a promotion that is still alive', async () => {
    await assertFails(add('owner-a', {}, A, 'o00'));
  });

  it('blocks deleting a promotion, even for its owner', async () => {
    await assertFails(deleteDoc(promotionOf(verified(env, 'owner-a'), A, 'o00')));
  });
});

describe('promotions — shape (marketing D5, D6, D15, H5)', () => {
  it.each([
    ['the hardest percentage', { ...PERCENT, percent: MAX_PERCENT_OFF }],
    ['the largest caps', { maxUnitsPerOrder: MAX_UNITS_PER_ORDER, totalUnits: MAX_TOTAL_UNITS }],
    [
      'the longest title and conditions',
      {
        title: 'T'.repeat(PROMOTION_TITLE_MAX_LENGTH),
        conditions: 'C'.repeat(PROMOTION_CONDITIONS_MAX_LENGTH),
      },
    ],
    ['conditions with accents and ñ', { conditions: 'Solo pedidos por Hornilla en Ñaña' }],
    [
      'every product of the catalogue',
      {
        ...PERCENT,
        productIds: Array.from({ length: 30 }, (_, i) => `p${String(i).padStart(2, '0')}`),
      },
    ],
  ])('accepts %s', async (_case, change) => {
    await assertSucceeds(add('owner-a', change));
  });

  it.each([
    ['a field it does not know', { badge: 'Oferta' }],
    ['the parameter of another kind', { percent: 10 }],
    ['a kind it does not know', { type: 'gift' }],
    ['an empty title', { title: '' }],
    ['a title too long', { title: 'T'.repeat(PROMOTION_TITLE_MAX_LENGTH + 1) }],
    ['a title of invisible characters', { title: '​' }],
    ['a title padded with spaces', { title: 'Oferta ' }],
    ['conditions too long', { conditions: 'C'.repeat(PROMOTION_CONDITIONS_MAX_LENGTH + 1) }],
    ['conditions padded with spaces', { conditions: ' Solo web' }],
    ['"hasta agotar stock"', { conditions: 'Hasta agotar stock' }],
    ['"Hasta  AGOTÁR" with accents and spaces', { conditions: 'Válido hasta  AGOTÁR existencias' }],
    ['"últimas unidades"', { conditions: 'Últimas unidades' }],
    ['"últimas unidades" with a combining accent', { conditions: 'Últimas unidades' }],
    ['"unidades limitadas"', { conditions: 'Unidades limitadas' }],
    ['"quedan pocas"', { conditions: 'Quedan pocas' }],
    ['no product', { productIds: [] }],
    ['a product twice', { ...PERCENT, productIds: ['p00', 'p00'] }],
    ['a product outside the slots', { ...PERCENT, productIds: ['p30'] }],
    ['more than one product for a special price', { productIds: ['p00', 'p01'] }],
    ['products that are not a list', { productIds: 'p00' }],
    ['another way of selling', { saleMode: 'both' }],
    ['a special price of zero', { priceCents: 0 }],
    ['a special price above S/ 999', { priceCents: 99_901 }],
    ['a special price with a fraction of a cent', { priceCents: 4800.5 }],
    ['a special price without its amount', { priceCents: null }],
    ['another price source', { priceSource: 'list' }],
    ['the price of gas with an amount', { ...GAS_PRICE, priceCents: 5200 }],
    ['the price of gas on a refill', { ...GAS_PRICE, saleMode: 'refill' }],
    ['the price of gas twice per order', { ...GAS_PRICE, maxUnitsPerOrder: 2 }],
    ['the price of gas without a total cap (D5)', { ...GAS_PRICE, totalUnits: null }],
    ['a percentage of zero', { ...PERCENT, percent: 0 }],
    ['a percentage above 30 (D6)', { ...PERCENT, percent: MAX_PERCENT_OFF + 1 }],
    ['a percentage with decimals', { ...PERCENT, percent: 10.5 }],
    ['an amount of zero', { ...AMOUNT, amountCents: 0 }],
    ['an amount above S/ 999', { ...AMOUNT, amountCents: 99_901 }],
    ['"lleva 3, paga 1"', { ...TWO_FOR_ONE, buyUnits: 3, payUnits: 1, maxUnitsPerOrder: 3 }],
    ['"lleva 2, paga 2"', { ...TWO_FOR_ONE, payUnits: 2 }],
    ['"lleva 2, paga 1" with 3 per order', { ...TWO_FOR_ONE, maxUnitsPerOrder: 3 }],
    ['"lleva 2, paga 1" without a total cap (D15)', { ...TWO_FOR_ONE, totalUnits: null }],
    ['no unit per order', { maxUnitsPerOrder: 0 }],
    ['more units per order than the cap', { maxUnitsPerOrder: MAX_UNITS_PER_ORDER + 1 }],
    ['a total cap of zero', { totalUnits: 0 }],
    ['a total cap above the limit', { totalUnits: MAX_TOTAL_UNITS + 1 }],
    ['a total cap with decimals', { totalUnits: 10.5 }],
    ['units already sold', { soldUnits: 1 }],
    ['units sold that are not a number', { soldUnits: '0' }],
    ['a "published" that is not a boolean', { active: 'yes' }],
    ['somebody else as its author', { createdBy: 'owner-b' }],
    ['a creation date that is not now', { createdAt: AT }],
    ['an update date that is not now', { updatedAt: AT }],
    [
      'a switch-off already written',
      { switchedOffBy: 'owner-a', switchedOffAt: serverTimestamp() },
    ],
  ])('blocks %s', async (_case, change) => {
    await assertFails(add('owner-a', change));
  });
});

describe('promotions — validity (D6, H12)', () => {
  it.each([
    ['the longest validity', { endsAt: ahead(MAX_PROMOTION_DAYS * MS_PER_DAY - 60_000) }],
    [
      'the latest start',
      {
        startsAt: ahead(MAX_SCHEDULE_AHEAD_DAYS * MS_PER_DAY - 60_000),
        endsAt: ahead((MAX_SCHEDULE_AHEAD_DAYS + 1) * MS_PER_DAY),
      },
    ],
  ])('accepts %s', async (_case, change) => {
    await assertSucceeds(add('owner-a', change));
  });

  it.each([
    ['a start in the past', { startsAt: ago(60_000) }],
    [
      'a start too far ahead',
      {
        startsAt: ahead(MAX_SCHEDULE_AHEAD_DAYS * MS_PER_DAY + HOUR),
        endsAt: ahead(40 * MS_PER_DAY),
      },
    ],
    ['an end before the start', { startsAt: daysFromNow(2), endsAt: daysFromNow(1) }],
    ['an end equal to the start', { startsAt: daysFromNow(2), endsAt: daysFromNow(2) }],
    ['an end that already passed', { endsAt: ago(60_000) }],
    ['more than 30 days (D6)', { endsAt: ahead(MAX_PROMOTION_DAYS * MS_PER_DAY + HOUR) }],
    ['a start that is not a date', { startsAt: '2026-10-16' }],
    ['an end that is not a date', { endsAt: 1_800_000_000_000 }],
  ])('blocks %s', async (_case, change) => {
    await assertFails(add('owner-a', change));
  });
});

describe('promotions — reusing a slot', () => {
  it.each([
    ['ended', { endsAt: ago(60_000) }],
    ['switched off', { active: false, switchedOffBy: 'owner-a', switchedOffAt: ago(MS_PER_DAY) }],
    ['saved without publishing', { active: false }],
  ])('lets the owner write a new promotion over one %s', async (_case, before) => {
    await seedDoc(env, promotionPath(A, 'o05'), stored(before));
    await assertSucceeds(add('owner-a', { ...PERCENT }, A, 'o05'));
  });

  it('demands a whole new promotion: created now, with no unit sold', async () => {
    await seedDoc(env, promotionPath(A, 'o05'), stored({ endsAt: ago(60_000) }));
    await assertFails(add('owner-a', { createdAt: AT }, A, 'o05'));
    await assertFails(add('owner-a', { soldUnits: 3 }, A, 'o05'));
  });

  it('lets the dispatcher reuse a slot, and blocks the driver', async () => {
    await seedDoc(env, promotionPath(A, 'o05'), stored({ endsAt: ago(60_000) }));
    await assertFails(add('driver-a', {}, A, 'o05'));
    await assertSucceeds(add('dispatcher-a', {}, A, 'o05'));
  });
});

const edit = (uid: string, change: Record<string, unknown>, d = A, slot = 'o00') =>
  updateDoc(promotionOf(verified(env, uid), d, slot), { ...change, ...stamp });
const switchOff = (uid: string, d = A, slot = 'o00') =>
  edit(uid, { active: false, switchedOffBy: uid, switchedOffAt: serverTimestamp() }, d, slot);

describe('promotions — what may change (marketing §4)', () => {
  it('lets the owner rename it', async () => {
    await assertSucceeds(edit('owner-a', { title: 'Semana del gas' }));
  });

  it('lets the owner extend it up to 30 days from its start', async () => {
    await assertSucceeds(
      edit('owner-a', { endsAt: ahead(MAX_PROMOTION_DAYS * MS_PER_DAY - MS_PER_DAY - 60_000) }),
    );
  });

  it('lets the owner publish one saved without publishing', async () => {
    await assertSucceeds(edit('owner-a', { active: true }, A, 'o01'));
  });

  it('lets the owner switch one off, saying who and when', async () => {
    await assertSucceeds(switchOff('owner-a'));
  });

  it.each([
    ['shortening it (customers saw its end)', { endsAt: daysFromNow(5) }],
    [
      'extending it beyond 30 days from its start',
      { endsAt: ahead(MAX_PROMOTION_DAYS * MS_PER_DAY) },
    ],
    ['its price', { priceCents: 4500 }],
    ['its products', { productIds: ['p01'] }],
    ['its way of selling', { saleMode: 'full' }],
    [
      'its kind',
      { type: 'percentOff', priceSource: deleteField(), priceCents: deleteField(), percent: 10 },
    ],
    ['its cap per order', { maxUnitsPerOrder: 3 }],
    ['its total cap', { totalUnits: 40 }],
    ['its start', { startsAt: ago(2 * MS_PER_DAY) }],
    ['its conditions', { conditions: 'Solo web' }],
    ['the units sold', { soldUnits: 5 }],
    ['its author', { createdBy: 'owner-b' }],
    ['its creation date', { createdAt: serverTimestamp() }],
    ['an empty title', { title: '' }],
  ])('blocks the owner from changing %s', async (_case, change) => {
    await assertFails(edit('owner-a', change));
  });

  it('blocks an edit that does not move the update date to now', async () => {
    await assertFails(
      updateDoc(promotionOf(verified(env, 'owner-a'), A, 'o00'), { title: 'Semana del gas' }),
    );
  });

  it('lets the dispatcher rename one and switch it off', async () => {
    await assertSucceeds(edit('dispatcher-a', { title: 'Semana del gas' }));
    await assertSucceeds(switchOff('dispatcher-a'));
  });

  it.each(['driver-a', 'owner-b', 'dispatcher-b', CUSTOMER_UID, ADMIN_UID])(
    'blocks %s from renaming or switching off one of A',
    async (uid) => {
      await assertFails(edit(uid, { title: 'Semana del gas' }));
      await assertFails(switchOff(uid));
    },
  );

  it('blocks the owner of a suspended distributor, also to switch one off', async () => {
    await assertFails(switchOff('owner-suspended', WORLD.suspended.d));
  });
});

describe('promotions — what can no longer change', () => {
  const OFF = { active: false, switchedOffBy: 'owner-a', switchedOffAt: ago(60_000) };

  it.each([
    ['ended', { endsAt: ago(60_000) }],
    ['switched off', OFF],
  ])('blocks renaming or extending one %s', async (_case, before) => {
    await seedDoc(env, promotionPath(A, 'o05'), stored(before));
    await assertFails(edit('owner-a', { title: 'Otra vez' }, A, 'o05'));
    await assertFails(edit('owner-a', { endsAt: daysFromNow(8) }, A, 'o05'));
  });

  it('blocks publishing again one switched off ("Repetir" makes another)', async () => {
    await seedDoc(env, promotionPath(A, 'o05'), stored(OFF));
    await assertFails(edit('owner-a', { active: true }, A, 'o05'));
  });

  it('blocks publishing one that ended unpublished', async () => {
    await seedDoc(env, promotionPath(A, 'o05'), stored({ active: false, endsAt: ago(60_000) }));
    await assertFails(edit('owner-a', { active: true }, A, 'o05'));
  });

  it.each([
    ['without saying who', { active: false, switchedOffAt: serverTimestamp() }],
    [
      'in the name of somebody else',
      { active: false, switchedOffBy: 'owner-b', switchedOffAt: serverTimestamp() },
    ],
    ['with another time', { active: false, switchedOffBy: 'owner-a', switchedOffAt: AT }],
    ['without switching it off', { switchedOffBy: 'owner-a', switchedOffAt: serverTimestamp() }],
    [
      'while renaming it',
      { active: false, switchedOffBy: 'owner-a', switchedOffAt: serverTimestamp(), title: 'Otra' },
    ],
  ])('blocks switching one off %s', async (_case, change) => {
    await assertFails(edit('owner-a', change));
  });

  it('blocks switching off one that was never published', async () => {
    await assertFails(switchOff('owner-a', A, 'o01'));
  });

  it('blocks unpublishing one without recording the switch-off', async () => {
    await assertFails(edit('owner-a', { active: false }));
  });

  it('blocks publishing and changing something else at once', async () => {
    await assertFails(edit('owner-a', { active: true, maxUnitsPerOrder: 5 }, A, 'o01'));
  });
});
