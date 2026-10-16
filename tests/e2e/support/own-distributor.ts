// A whole distributor that belongs to one test: its own accounts, catalogue and staff, written
// with the rules bypassed like the seed does. Flows that change a catalogue or a staff use it
// instead of seeded A, which other specs read at the same time. EVERYTHING HERE IS INVENTED.
import { createHash } from 'node:crypto';
import type { SeedUser } from '../../seed/data';
import { SEED_PRIVACY_VERSION, SEED_TERMS_VERSION } from '../../seed/data';
import { createTestAccount, writeDocument } from './emulator-admin';

export type StaffRole = 'owner' | 'dispatcher' | 'driver';

export interface OwnProduct {
  /** Slot, p00 … p29. */
  id: string;
  brand: string;
  weightKg: number;
  refillPriceCents: number;
  fullPriceCents?: number | null;
  active?: boolean;
}

export interface OwnDistributorOptions {
  products: OwnProduct[];
  /** Everybody but the founder, who is always there as owner. */
  staff?: { key: string; role: StaffRole }[];
  status?: 'active' | 'suspended';
}

export interface OwnDistributor {
  id: string;
  name: string;
  slug: string;
  plant: { latitude: number; longitude: number };
  founder: SeedUser;
  /** The account of one of `staff`, by its key. */
  person: (key: string) => SeedUser;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULE = { days: [0, 1, 2, 3, 4, 5, 6], opensAt: '07:00', closesAt: '20:00' };
/** Follows the fake pattern 9000000xx of the seed. */
const PHONE = '900000097';
/** Invented RUC with a valid check digit (see SEED_TAX_IDS in tests/seed/data.ts). */
const TAX_ID = '20000000001';

/**
 * Somewhere in the north-west of the country, far from every seeded plant and from the founding
 * plant of the other specs; two tests land kilometres apart.
 */
function plantOf(tag: string) {
  const digest = createHash('sha256').update(tag).digest();
  return {
    latitude: -6.5 - digest.readUInt16BE(0) / 65_535,
    longitude: -79.5 - digest.readUInt16BE(2) / 65_535,
  };
}

/** Cheapest refill on sale and its brands, the way `summarizeCatalog` writes them. */
function summaryOf(products: OwnProduct[]) {
  const onSale = products.filter((product) => product.active !== false);
  const cheapest = onSale.reduce<OwnProduct | null>(
    (best, product) =>
      best === null || product.refillPriceCents < best.refillPriceCents ? product : best,
    null,
  );
  return {
    brands: [...new Set(onSale.map((product) => product.brand))],
    priceFromCents: cheapest?.refillPriceCents ?? null,
    priceFromWeightKg: cheapest?.weightKg ?? null,
  };
}

/**
 * Writes the distributor, approved and taking orders (or suspended), with its founder and the
 * staff asked for. Its id starts with "0": the finder reads the first 50 visible distributors
 * in id order, and a lane full of distributors other specs founded must not push it out.
 */
export async function ownDistributor(
  tag: string,
  { products, staff = [], status = 'active' }: OwnDistributorOptions,
): Promise<OwnDistributor> {
  const id = `0flow-${tag}`;
  const name = `Gas Flujo ${tag}`;
  const slug = `flujo-${tag}`;
  const plant = plantOf(tag);
  const founder = await createTestAccount(`${tag}-titular`);
  const people = new Map<string, SeedUser>();
  for (const { key } of staff) people.set(key, await createTestAccount(`${tag}-${key}`));
  const person = (key: string) => {
    const account = people.get(key);
    if (!account) throw new Error(`No "${key}" in the staff of this distributor`);
    return account;
  };
  const now = new Date();
  const stamps = { createdAt: now, updatedAt: now };

  await writeDocument(`distributors/${id}`, {
    name,
    slug,
    contactPhone: PHONE,
    whatsapp: PHONE,
    addressLine: 'Av. Flujo 100',
    plant: { lat: plant.latitude, lng: plant.longitude },
    coverageRadiusKm: 5,
    brandColor: '#d9480f',
    acceptingOrders: status === 'active',
    schedule: SCHEDULE,
    maxCylindersPerOrder: 3,
    ...summaryOf(products),
    currency: 'PEN',
    ...stamps,
  });
  await writeDocument(`distributors/${id}/private/control`, {
    ownerUid: founder.uid,
    status,
    trialEndsAt: new Date(now.getTime() - DAY_MS),
    listingApproved: true,
    approvedAt: now,
    approvedBy: 'seed-admin',
    distributorName: name,
    slug,
    ...stamps,
  });
  await writeDocument(`distributors/${id}/private/settings`, {
    ownerUid: founder.uid,
    ownerName: founder.displayName,
    ownerPhone: founder.phone,
    ownerEmail: founder.email,
    plan: 'trial',
    taxId: TAX_ID,
    legalName: `${name} S.A.C.`,
    hydrocarbonsRegistry: '00000-074-000097',
    terms: { version: SEED_TERMS_VERSION, acceptedAt: now },
    authorityDeclaredAt: now,
    ...stamps,
  });
  await writeDocument(`slugs/${slug}`, { distributorId: id, createdAt: now });
  for (const [index, product] of products.entries()) {
    await writeDocument(`distributors/${id}/products/${product.id}`, {
      brand: product.brand,
      brandColor: null,
      weightKg: product.weightKg,
      name: `Balón ${product.weightKg} kg`,
      refillPriceCents: product.refillPriceCents,
      fullPriceCents: product.fullPriceCents ?? null,
      currency: 'PEN',
      active: product.active ?? true,
      sortOrder: index,
      ...stamps,
    });
  }
  const members = [
    { user: founder, role: 'owner' as StaffRole },
    ...staff.map(({ key, role }) => ({ user: person(key), role })),
  ];
  for (const { user, role } of members) {
    await writeDocument(`distributors/${id}/members/${user.uid}`, {
      uid: user.uid,
      distributorId: id,
      role,
      active: true,
      displayName: user.displayName,
      distributorName: name,
      ...stamps,
    });
  }
  await writeDocument(`users/${founder.uid}`, {
    displayName: founder.displayName,
    phone: founder.phone,
    ownedDistributorIds: [id],
    terms: { version: SEED_TERMS_VERSION, acceptedAt: now },
    privacy: { version: SEED_PRIVACY_VERSION, acceptedAt: now },
    ...stamps,
  });
  return { id, name, slug, plant, founder, person };
}
