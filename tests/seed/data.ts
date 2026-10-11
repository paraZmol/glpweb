// Seed data for the emulators. EVERYTHING HERE IS INVENTED: the repository is public.
// Names are an initial and a role, e-mails use example.com, phones follow the fake pattern
// 9000000xx, coordinates are round grid points near a city centre (nobody's address).
//
// This file imports nothing so that plain `node` can run the seed (see seed.ts).

/** Test-only password shared by every seeded account. It protects nothing. */
export const SEED_PASSWORD = 'solo-para-pruebas'; // public-ok: fake password for emulator accounts

export type SeedRole = 'owner' | 'dispatcher' | 'driver';
export type SeedStatus = 'trial' | 'active' | 'pastDue' | 'suspended';

export interface SeedUser {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  emailVerified: boolean;
  /** False for an account that signed in but never got a profile (terms still pending). */
  hasProfile: boolean;
}

export interface SeedDistributor {
  id: string;
  name: string;
  slug: string;
  status: SeedStatus;
  /** ISO date; `null` means "thirty days after the seed runs" (a trial that is still on). */
  trialEndsAt: string | null;
  /** Whether a platform admin approved its listing (PLAN 2.11). */
  listingApproved: boolean;
  /** Invented verification data; see `SEED_TAX_IDS` for how the RUC was made up. */
  taxId: string;
  legalName: string;
  hydrocarbonsRegistry: string;
  contactPhone: string;
  addressLine: string;
  plant: { lat: number; lng: number };
  coverageRadiusKm: number;
  brandColor: string;
  brands: string[];
  priceFromCents: number | null;
  /** The first owner listed is the founder. */
  members: { user: SeedUser; role: SeedRole }[];
}

/** Versions of the terms and of the privacy policy every seeded profile accepted. */
export const SEED_TERMS_VERSION = '0.1';
export const SEED_PRIVACY_VERSION = '0.1';

const user = (key: string, displayName: string, phoneSuffix: string, emailVerified = true) => ({
  uid: `seed-${key}`,
  email: `${key}@example.com`,
  displayName,
  phone: `9000000${phoneSuffix}`,
  emailVerified,
  hasProfile: true,
});

export const SEED_USERS = {
  ownerA: user('owner-a', 'A. Dueña', '11'),
  dispatcherA: user('central-a', 'B. Central', '12'),
  driverA: user('repartidor-a', 'C. Repartidor', '13'),
  ownerB: user('owner-b', 'D. Dueño', '21'),
  dispatcherB: user('central-b', 'E. Central', '22'),
  driverB: user('repartidor-b', 'F. Repartidora', '23'),
  ownerC: user('owner-c', 'G. Dueña', '31'),
  ownerD: user('owner-d', 'H. Dueño', '41'),
  /** Founder of E, the distributor that is still waiting for its review. */
  ownerE: user('owner-e', 'N. Dueña', '95'),
  /** Has a profile and no membership anywhere. */
  customer: user('cliente', 'I. Cliente', '51'),
  /** Platform admin: listed in /platformAdmins. */
  admin: user('admin', 'J. Plataforma', '61'),
  /** Registered but never followed the verification link. */
  unverified: user('sin-verificar', 'K. Nueva', '71', false),
  /** Verified account without a profile: what a first Google sign-in looks like. */
  noProfile: { ...user('sin-perfil', 'L. Reciente', '81'), hasProfile: false },
  /**
   * Verified, with a profile and no membership: the account the E2E of the sign-up of a
   * distributor founds with (PLAN 2.2). No other test may rely on what it owns.
   */
  founder: user('fundadora', 'M. Fundadora', '91'),
} as const satisfies Record<string, SeedUser>;

export const SEED_CREATED_AT = '2025-12-01T15:00:00Z';
const TRIAL_LONG_OVER = '2026-01-01T15:00:00Z';

/** Where a seeded customer "is": inside the coverage of A and B, outside C, D and E. */
export const SEED_CUSTOMER_LOCATION = { lat: -12.05, lng: -77.04 };

/**
 * Invented RUCs with a valid check digit, so the forms and the domain accept them. How they
 * were made: prefix `20` (company), seven zeros, one counting digit, and then the check digit
 * SUNAT's algorithm gives for those ten digits (weights 5 4 3 2 7 6 5 4 3 2, modulus 11, eleven
 * minus the remainder; 10 → 0, 11 → 1). `2000000000` → 1, `2000000001` → 0, `2000000002` → 8,
 * `2000000003` → 6, `2000000004` → 4. They are plainly test numbers: no real taxpayer number
 * has seven zeros in its identity part. `src/domain/tenancy/tax-id.test.ts` checks them.
 */
export const SEED_TAX_IDS = {
  a: '20000000001',
  b: '20000000010',
  c: '20000000028',
  d: '20000000036',
  e: '20000000044',
} as const;

/** Invented record numbers: only their shape resembles a record of the registry. */
const registryNumber = (counter: number) => `00000-074-00000${counter}`;

export const SEED_DISTRIBUTORS = {
  /** Healthy, paying. */
  a: {
    id: 'seed-dist-a',
    name: 'Gas Demo Norte',
    slug: 'gas-demo-norte',
    status: 'active',
    trialEndsAt: TRIAL_LONG_OVER,
    listingApproved: true,
    taxId: SEED_TAX_IDS.a,
    legalName: 'Gas Demo Norte S.A.C.',
    hydrocarbonsRegistry: registryNumber(1),
    contactPhone: '900000011',
    addressLine: 'Av. Ejemplo 100',
    plant: { lat: -12.04, lng: -77.04 },
    coverageRadiusKm: 5,
    brandColor: '#d9480f',
    brands: ['Marca Uno', 'Marca Dos'],
    priceFromCents: 3800,
    members: [
      { user: SEED_USERS.ownerA, role: 'owner' },
      { user: SEED_USERS.dispatcherA, role: 'dispatcher' },
      { user: SEED_USERS.driverA, role: 'driver' },
    ],
  },
  /** Healthy, paying; the "other distributor" of every isolation test. */
  b: {
    id: 'seed-dist-b',
    name: 'Gas Demo Sur',
    slug: 'gas-demo-sur',
    status: 'active',
    trialEndsAt: TRIAL_LONG_OVER,
    listingApproved: true,
    taxId: SEED_TAX_IDS.b,
    legalName: 'Gas Demo Sur E.I.R.L.',
    hydrocarbonsRegistry: registryNumber(2),
    contactPhone: '900000021',
    addressLine: 'Jr. Muestra 200',
    plant: { lat: -12.07, lng: -77.03 },
    coverageRadiusKm: 4,
    brandColor: '#0a7cff',
    brands: ['Marca Tres'],
    priceFromCents: 3650,
    members: [
      { user: SEED_USERS.ownerB, role: 'owner' },
      { user: SEED_USERS.dispatcherB, role: 'dispatcher' },
      { user: SEED_USERS.driverB, role: 'driver' },
    ],
  },
  /** Suspended by the platform: read-only, and no longer readable by visitors. */
  c: {
    id: 'seed-dist-c',
    name: 'Gas Demo Suspendida',
    slug: 'gas-demo-suspendida',
    status: 'suspended',
    trialEndsAt: TRIAL_LONG_OVER,
    listingApproved: true,
    taxId: SEED_TAX_IDS.c,
    legalName: 'Gas Demo Suspendida S.A.C.',
    hydrocarbonsRegistry: registryNumber(3),
    contactPhone: '900000031',
    addressLine: 'Calle Prueba 300',
    plant: { lat: -12.2, lng: -76.9 },
    coverageRadiusKm: 3,
    brandColor: '#5c6770',
    brands: [],
    priceFromCents: null,
    members: [{ user: SEED_USERS.ownerC, role: 'owner' }],
  },
  /**
   * Still `trial`, but the trial ended: read-only. Seeded as already unlisted (its public
   * `acceptingOrders` is false), which is how it looks once its staff opened the panel.
   */
  d: {
    id: 'seed-dist-d',
    name: 'Gas Demo Prueba Vencida',
    slug: 'gas-demo-prueba-vencida',
    status: 'trial',
    trialEndsAt: '2026-01-15T15:00:00Z',
    listingApproved: true,
    taxId: SEED_TAX_IDS.d,
    legalName: 'Gas Demo Prueba Vencida S.A.C.',
    hydrocarbonsRegistry: registryNumber(4),
    contactPhone: '900000041',
    addressLine: 'Pasaje Demo 400',
    plant: { lat: -11.9, lng: -77.1 },
    coverageRadiusKm: 3,
    brandColor: '#2f9e44',
    brands: [],
    priceFromCents: null,
    members: [{ user: SEED_USERS.ownerD, role: 'owner' }],
  },
  /**
   * Just founded and waiting for its review (PLAN 2.11): on a running trial, not approved, so
   * it takes no orders and visitors cannot read it. Its plant is far from every other one.
   */
  e: {
    id: 'seed-dist-e',
    name: 'Gas Demo En Revisión',
    slug: 'gas-demo-en-revision',
    status: 'trial',
    trialEndsAt: null,
    listingApproved: false,
    taxId: SEED_TAX_IDS.e,
    legalName: 'Gas Demo En Revisión S.A.C.',
    hydrocarbonsRegistry: registryNumber(5),
    contactPhone: '900000095',
    addressLine: 'Av. Ensayo 500',
    plant: { lat: -13.5, lng: -72 },
    coverageRadiusKm: 3,
    brandColor: '#7048e8',
    brands: [],
    priceFromCents: null,
    members: [{ user: SEED_USERS.ownerE, role: 'owner' }],
  },
} as const satisfies Record<string, SeedDistributor>;
