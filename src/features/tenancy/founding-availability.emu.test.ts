import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SEED_DISTRIBUTORS,
  SEED_PASSWORD,
  SEED_USERS,
  type SeedUser,
} from '../../../tests/seed/data';
import { seedEmulators } from '../../../tests/seed/seed';
import { markEmailVerified } from '../../../tests/support/emulator';
import {
  refreshSession,
  registerWithEmail,
  signInWithEmail,
  signOutSession,
} from '../../data/auth-repo';
import { getOwnedControls } from '../../data/distributors-repo';
import { setDistributorStatus } from '../../data/platform-repo';
import { createUserProfile } from '../../data/users-repo';
import type { Session } from '../../domain/auth/session';
import { CURRENT_LEGAL_VERSIONS } from '../../domain/legal/versions';
import { MAX_DISTRIBUTORS_PER_ACCOUNT } from '../../domain/tenancy/constants';
import {
  DistributorLimitError,
  FoundingBlockedError,
  PermissionDeniedError,
} from '../../domain/tenancy/errors';
import {
  checkOwnedDistributors,
  foundDistributor,
  type FoundingInput,
  getFoundingAvailability,
} from './tenancy-actions';

const { a: A, b: B } = SEED_DISTRIBUTORS;
const signInAs = (user: SeedUser) => signInWithEmail(user.email, SEED_PASSWORD);

const inputOf = (slug: string): FoundingInput => ({
  name: 'Gas Demo Cupo',
  slug,
  contactPhone: '900000093',
  addressLine: 'Av. Cupo 100',
  plant: { lat: -12.06, lng: -77.05 },
  ownerName: 'N. Fundadora',
  ownerPhone: '900000094',
  taxId: '20000000001',
  legalName: 'Gas Demo Cupo S.A.C.',
  hydrocarbonsRegistry: '00000-074-000093',
  acceptTerms: true,
  declaresAuthority: true,
});

/** A fresh, verified account with a profile, signed in. */
async function freshFounder(key: string): Promise<Session> {
  const email = `${key}@example.com`;
  const created = await registerWithEmail({ email, password: SEED_PASSWORD });
  await markEmailVerified(created.uid);
  const session = await refreshSession();
  if (session === null) throw new Error('The fresh account should be signed in');
  await createUserProfile(
    session.uid,
    { displayName: 'N. Fundadora', phone: null },
    CURRENT_LEGAL_VERSIONS,
  );
  return session;
}

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

// PLAN 2.11: what the founding would answer, known before the form is filled.
describe('getFoundingAvailability', () => {
  it.each([
    ['a customer', SEED_USERS.customer, 'available'],
    ['the founder of an active distributor', SEED_USERS.ownerA, 'available'],
    ['the founder of one that only waits for its review', SEED_USERS.ownerE, 'available'],
    ['a driver, who founded nothing', SEED_USERS.driverA, 'available'],
    ['the founder of a suspended distributor', SEED_USERS.ownerC, 'blocked'],
    ['the founder of one whose trial ran out', SEED_USERS.ownerD, 'blocked'],
  ] as const)('answers for %s', async (_who, user, expected) => {
    const session = await signInAs(user);

    expect(await getFoundingAvailability(session.uid)).toBe(expected);
  });

  it('answers "available" for an account that has no profile yet', async () => {
    const session = await signInAs(SEED_USERS.noProfile);

    expect(await getFoundingAvailability(session.uid)).toBe('available');
  });

  it('refuses to answer for another account', async () => {
    await signInAs(SEED_USERS.customer);

    await expect(getFoundingAvailability(SEED_USERS.ownerC.uid)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  // The gap this closes: the read-only distributor is not the one the panels show.
  it('sees a suspended distributor among several, and agrees with the founding', async () => {
    const founder = await freshFounder('fundadora-bloqueo');
    const first = await foundDistributor(founder, inputOf('gas-demo-bloqueo-uno'));
    await foundDistributor(founder, inputOf('gas-demo-bloqueo-dos'));
    expect(await getFoundingAvailability(founder.uid)).toBe('available');
    await signInAs(SEED_USERS.admin);
    await setDistributorStatus(first, 'suspended', new Date());
    await signInWithEmail(founder.email ?? '', SEED_PASSWORD);

    expect(await getFoundingAvailability(founder.uid)).toBe('blocked');
    // Asked only about the one that is not on screen, it still finds it.
    expect(await checkOwnedDistributors(2, [first])).toBe('blocked');
    await expect(
      foundDistributor(founder, inputOf('gas-demo-bloqueo-tres')),
    ).rejects.toBeInstanceOf(FoundingBlockedError);
  });

  it('says the cap is reached, and agrees with the founding', async () => {
    const founder = await freshFounder('fundadora-tope');
    for (let index = 0; index < MAX_DISTRIBUTORS_PER_ACCOUNT; index += 1) {
      await foundDistributor(founder, inputOf(`gas-demo-tope-${index}`));
    }

    expect(await getFoundingAvailability(founder.uid)).toBe('limitReached');
    await expect(foundDistributor(founder, inputOf('gas-demo-tope-extra'))).rejects.toBeInstanceOf(
      DistributorLimitError,
    );
  });
});

describe('getOwnedControls', () => {
  it('reads the control document of a distributor the account founded', async () => {
    await signInAs(SEED_USERS.ownerA);

    expect(await getOwnedControls([A.id])).toMatchObject([{ status: 'active' }]);
  });

  it('answers null, in place, for one that is not there or is not theirs', async () => {
    await signInAs(SEED_USERS.ownerA);

    const controls = await getOwnedControls(['no-existe', A.id, B.id]);

    expect(controls.map((control) => control?.ownerUid ?? null)).toEqual([
      null,
      SEED_USERS.ownerA.uid,
      null,
    ]);
    expect(await checkOwnedDistributors(2, ['no-existe', A.id])).toBe('blocked');
  });
});
