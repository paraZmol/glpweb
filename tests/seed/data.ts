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
  /** ISO date. Fixed, so the seed is the same on every run. */
  trialEndsAt: string;
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

/** Version of the terms every seeded profile and distributor accepted. */
export const SEED_TERMS_VERSION = '0.1';

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
  /** Has a profile and no membership anywhere. */
  customer: user('cliente', 'I. Cliente', '51'),
  /** Platform admin: listed in /platformAdmins. */
  admin: user('admin', 'J. Plataforma', '61'),
  /** Registered but never followed the verification link. */
  unverified: user('sin-verificar', 'K. Nueva', '71', false),
  /** Verified account without a profile: what a first Google sign-in looks like. */
  noProfile: { ...user('sin-perfil', 'L. Reciente', '81'), hasProfile: false },
} as const satisfies Record<string, SeedUser>;

export const SEED_CREATED_AT = '2025-12-01T15:00:00Z';
const TRIAL_LONG_OVER = '2026-01-01T15:00:00Z';

/** Where a seeded customer "is": inside the coverage of A and B, outside C and D. */
export const SEED_CUSTOMER_LOCATION = { lat: -12.05, lng: -77.04 };

export const SEED_DISTRIBUTORS = {
  /** Healthy, paying. */
  a: {
    id: 'seed-dist-a',
    name: 'Gas Demo Norte',
    slug: 'gas-demo-norte',
    status: 'active',
    trialEndsAt: TRIAL_LONG_OVER,
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
  /** Suspended by the platform: read-only. */
  c: {
    id: 'seed-dist-c',
    name: 'Gas Demo Suspendida',
    slug: 'gas-demo-suspendida',
    status: 'suspended',
    trialEndsAt: TRIAL_LONG_OVER,
    contactPhone: '900000031',
    addressLine: 'Calle Prueba 300',
    plant: { lat: -12.2, lng: -76.9 },
    coverageRadiusKm: 3,
    brandColor: '#5c6770',
    brands: [],
    priceFromCents: null,
    members: [{ user: SEED_USERS.ownerC, role: 'owner' }],
  },
  /** Still `trial`, but the trial ended: read-only. */
  d: {
    id: 'seed-dist-d',
    name: 'Gas Demo Prueba Vencida',
    slug: 'gas-demo-prueba-vencida',
    status: 'trial',
    trialEndsAt: '2026-01-15T15:00:00Z',
    contactPhone: '900000041',
    addressLine: 'Pasaje Demo 400',
    plant: { lat: -11.9, lng: -77.1 },
    coverageRadiusKm: 3,
    brandColor: '#2f9e44',
    brands: [],
    priceFromCents: null,
    members: [{ user: SEED_USERS.ownerD, role: 'owner' }],
  },
} as const satisfies Record<string, SeedDistributor>;
