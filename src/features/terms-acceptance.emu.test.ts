import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_PASSWORD, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { markEmailVerified } from '../../tests/support/emulator';
import { currentSession, refreshSession } from '../data/auth-repo';
import { getDistributorPrivateSettings } from '../data/distributors-repo';
import { getUserProfile } from '../data/users-repo';
import { InvalidInputError } from '../domain/tenancy/errors';
import { needsTermsAcceptance, TERMS_VERSION } from '../domain/legal/versions';
import { acceptCurrentTerms, registerAccount, signIn, signOut } from './auth/auth-actions';
import { type FoundingInput, foundDistributor } from './tenancy/tenancy-actions';

const REGISTRATION = {
  email: 'acepta-terminos@example.com',
  password: SEED_PASSWORD,
  displayName: 'P. Acepta',
  acceptTerms: true as const,
};

const FOUNDING: FoundingInput = {
  name: 'Gas Demo Legal',
  slug: 'gas-demo-legal',
  contactPhone: '900000095',
  addressLine: 'Av. Legal 600',
  plant: { lat: -12.06, lng: -77.05 },
  ownerName: 'P. Acepta',
  ownerPhone: '900000096',
  acceptTerms: true,
  declaresAuthority: true,
};

/** What a hostile or buggy caller sends: the type says `true`, the value does not. */
const unticked = false as unknown as true;

const fieldsOf = (error: unknown) =>
  error instanceof InvalidInputError ? error.issues.map((issue) => issue.field) : error;

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOut();
});

// PLAN 2.7
describe('terms at registration', () => {
  it('creates nothing when the terms are not accepted', async () => {
    await signOut();

    const failure = await registerAccount({ ...REGISTRATION, acceptTerms: unticked }).catch(
      (error: unknown) => error,
    );

    expect(fieldsOf(failure)).toEqual(['acceptTerms']);
    expect(currentSession()).toBeNull();
    await expect(signIn(REGISTRATION.email, REGISTRATION.password)).rejects.toThrow();
  });

  it('stores the accepted version with the profile', async () => {
    const session = await registerAccount(REGISTRATION);

    const profile = await getUserProfile(session.uid);
    expect(profile?.terms?.version).toBe(TERMS_VERSION);
    expect(needsTermsAcceptance(profile)).toBe(false);
  });
});

describe('acceptCurrentTerms', () => {
  it('does not invent a profile for an account that never accepted', async () => {
    const session = await signIn(SEED_USERS.noProfile.email, SEED_PASSWORD);

    const profile = await getUserProfile(session.uid);

    expect(profile).toBeNull();
    expect(needsTermsAcceptance(profile)).toBe(true);
  });

  it('creates the missing profile, named after the session, once the person accepts', async () => {
    const session = await signIn(SEED_USERS.noProfile.email, SEED_PASSWORD);

    await acceptCurrentTerms(session.uid);

    const profile = await getUserProfile(session.uid);
    expect(profile).toMatchObject({
      displayName: SEED_USERS.noProfile.displayName,
      terms: { version: TERMS_VERSION },
    });
    expect(needsTermsAcceptance(profile)).toBe(false);
  });

  it('renews the acceptance of an account that already has a profile', async () => {
    const session = await signIn(SEED_USERS.customer.email, SEED_PASSWORD);
    const seededAt = (await getUserProfile(session.uid))?.terms?.acceptedAt.getTime() ?? 0;

    await acceptCurrentTerms(session.uid);

    const renewedAt = (await getUserProfile(session.uid))?.terms?.acceptedAt.getTime() ?? 0;
    expect(renewedAt).toBeGreaterThan(seededAt);
  });
});

describe('terms and authority when founding a distributor', () => {
  async function verifiedFounder() {
    const session = await signIn(REGISTRATION.email, REGISTRATION.password);
    await markEmailVerified(session.uid);
    const refreshed = await refreshSession();
    if (!refreshed) throw new Error('The founder should be signed in');
    return refreshed;
  }

  it.each([
    ['the terms', { acceptTerms: unticked }, ['acceptTerms']],
    ['the authority declaration', { declaresAuthority: unticked }, ['declaresAuthority']],
    [
      'both',
      { acceptTerms: unticked, declaresAuthority: unticked },
      ['acceptTerms', 'declaresAuthority'],
    ],
  ])('founds nothing without %s', async (_case, change, expected) => {
    const session = await verifiedFounder();

    const failure = await foundDistributor(session, { ...FOUNDING, ...change }).catch(
      (error: unknown) => error,
    );

    expect(fieldsOf(failure)).toEqual(expected);
    expect((await getUserProfile(session.uid))?.ownedDistributorIds).toEqual([]);
  });

  it('reports form problems and missing declarations together', async () => {
    const session = await verifiedFounder();
    const broken = { ...FOUNDING, name: '', declaresAuthority: unticked };

    const failure = await foundDistributor(session, broken).catch((error: unknown) => error);

    expect(fieldsOf(failure)).toEqual(['name', 'declaresAuthority']);
  });

  it('stores the acceptance and the declaration in the private settings', async () => {
    const session = await verifiedFounder();

    const id = await foundDistributor(session, FOUNDING);

    const settings = await getDistributorPrivateSettings(id);
    expect(settings?.terms?.version).toBe(TERMS_VERSION);
    expect(settings?.authorityDeclaredAt).toBeInstanceOf(Date);
    expect(settings?.terms?.acceptedAt).toEqual(settings?.authorityDeclaredAt);
  });
});
