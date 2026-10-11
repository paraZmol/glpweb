import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_PASSWORD, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { markEmailVerified, rewindAcceptance } from '../../tests/support/emulator';
import { currentSession, refreshSession, registerWithEmail } from '../data/auth-repo';
import {
  getDistributorBySlug,
  getDistributorPrivateSettings,
  getStaffDistributor,
} from '../data/distributors-repo';
import { createUserProfile, getUserProfile } from '../data/users-repo';
import {
  CURRENT_LEGAL_VERSIONS,
  needsTermsAcceptance,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from '../domain/legal/versions';
import {
  AccountInUseError,
  EmailNotVerifiedError,
  InvalidInputError,
  PermissionDeniedError,
} from '../domain/tenancy/errors';
import {
  acceptCurrentTerms,
  acceptLegalDocuments,
  discardUnacceptedAccount,
  listLegalAcceptances,
  registerAccount,
  signIn,
  signOut,
  suggestedProfileOf,
} from './auth/auth-actions';
import { PENDING_PROFILE_KEY } from './auth/pending-profile';
import { type FoundingInput, foundDistributor } from './tenancy/tenancy-actions';

const REGISTRATION = {
  email: 'acepta-terminos@example.com',
  password: SEED_PASSWORD,
  displayName: '  P. Acepta ',
  phone: '900 000 097',
};

const FOUNDING: FoundingInput = {
  name: 'Gas Demo Legal',
  slug: 'gas-demo-legal',
  contactPhone: '900000095',
  addressLine: 'Av. Legal 600',
  plant: { lat: -12.06, lng: -77.05 },
  ownerName: 'P. Acepta',
  ownerPhone: '900000096',
  taxId: '20000000001',
  legalName: 'Gas Demo Legal S.A.C.',
  hydrocarbonsRegistry: '00000-074-000007',
  acceptTerms: true,
  declaresAuthority: true,
};

const LONG_AGO = new Date('2026-03-01T12:00:00Z');
/** An account that accepted the privacy policy before its current version was published. */
const BEHIND_IN_PRIVACY = { from: PRIVACY_VERSION, to: '0.0', at: LONG_AGO };

/** What a hostile or buggy caller sends: the type says `true`, the value does not. */
const unticked = false as unknown as true;

const fieldsOf = (error: unknown) =>
  error instanceof InvalidInputError ? error.issues.map((issue) => issue.field) : error;

/** The tab's own storage, which Node does not have. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

/** What following the link of the verification e-mail and coming back to the app does. */
async function verifyEmail(uid: string) {
  await markEmailVerified(uid);
  const refreshed = await refreshSession();
  if (!refreshed) throw new Error('The account should be signed in');
  return refreshed;
}

let tabStorage: Storage;

beforeAll(async () => {
  await seedEmulators();
});

beforeEach(() => {
  tabStorage = memoryStorage();
  vi.stubGlobal('sessionStorage', tabStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await signOut();
});

// PLAN 2.11: nothing is stored for an e-mail nobody proved is theirs.
describe('registration — nothing on the server before the e-mail is verified', () => {
  it('creates only the sign-in account: no profile, no consent, no name', async () => {
    const session = await registerAccount(REGISTRATION);

    expect(session).toMatchObject({ emailVerified: false, displayName: null });
    expect(await getUserProfile(session.uid)).toBeNull();
  });

  it('keeps what the person typed in the tab, to offer it on the terms step', async () => {
    const session = await registerAccount({ ...REGISTRATION, email: 'recuerda@example.com' });

    expect(suggestedProfileOf(session)).toEqual({ displayName: 'P. Acepta', phone: '900000097' });
    expect(tabStorage.getItem(PENDING_PROFILE_KEY)).toContain(session.uid);
  });

  it('refuses the acceptance, and the profile itself, while the e-mail is not verified', async () => {
    const session = await signIn(REGISTRATION.email, REGISTRATION.password);

    await expect(acceptLegalDocuments(session.uid)).rejects.toBeInstanceOf(EmailNotVerifiedError);
    await expect(
      createUserProfile(session.uid, { displayName: 'X', phone: null }, CURRENT_LEGAL_VERSIONS),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(await getUserProfile(session.uid)).toBeNull();
  });

  it.each([
    ['a blank name', { displayName: '   ' }, ['displayName']],
    ['a phone that is not a mobile', { phone: '12345' }, ['phone']],
  ])('creates no account at all with %s', async (_case, change, expected) => {
    await signOut();
    const email = 'no-se-crea@example.com';

    const failure = await registerAccount({ ...REGISTRATION, email, ...change }).catch(
      (error: unknown) => error,
    );

    expect(fieldsOf(failure)).toEqual(expected);
    expect(currentSession()).toBeNull();
    await expect(signIn(email, REGISTRATION.password)).rejects.toThrow();
  });

  it('creates the profile with both consents once verified, from what was typed', async () => {
    const registered = await registerAccount({ ...REGISTRATION, email: 'verifica@example.com' });
    const session = await verifyEmail(registered.uid);

    await acceptLegalDocuments(session.uid);

    const profile = await getUserProfile(session.uid);
    expect(profile).toMatchObject({
      displayName: 'P. Acepta',
      phone: '900000097',
      terms: { version: TERMS_VERSION },
      privacy: { version: PRIVACY_VERSION },
    });
    expect(needsTermsAcceptance(profile)).toBe(false);
    expect((await listLegalAcceptances(session.uid)).map((entry) => entry.id).toSorted()).toEqual([
      `privacy-${PRIVACY_VERSION}`,
      `terms-${TERMS_VERSION}`,
    ]);
    // What the tab kept is gone, and the session now carries the name.
    expect(tabStorage.getItem(PENDING_PROFILE_KEY)).toBeNull();
    expect(currentSession()?.displayName).toBe('P. Acepta');
  });

  it('prefers the details the terms step sends over what the tab kept', async () => {
    const session = await verifyEmail(
      (await signIn(REGISTRATION.email, REGISTRATION.password)).uid,
    );

    await acceptLegalDocuments(session.uid, { displayName: ' P. Corregida ', phone: null });

    expect(await getUserProfile(session.uid)).toMatchObject({
      displayName: 'P. Corregida',
      phone: null,
    });
  });

  it('refuses invalid details on the terms step and creates nothing', async () => {
    const registered = await registerAccount({ ...REGISTRATION, email: 'detalles@example.com' });
    const session = await verifyEmail(registered.uid);

    const failure = await acceptLegalDocuments(session.uid, {
      displayName: '',
      phone: '123',
    }).catch((error: unknown) => error);

    expect(fieldsOf(failure)).toEqual(['displayName', 'phone']);
    expect(await getUserProfile(session.uid)).toBeNull();
  });

  it('never hands what one account typed to another on the same tab', async () => {
    await registerAccount({ ...REGISTRATION, email: 'primera@example.com' });
    const other = await signIn(SEED_USERS.noProfile.email, SEED_PASSWORD);

    expect(suggestedProfileOf(other)).toEqual({
      displayName: SEED_USERS.noProfile.displayName,
      phone: null,
    });
  });
});

describe('acceptLegalDocuments', () => {
  it('does not invent a profile for an account that never accepted', async () => {
    const session = await signIn(SEED_USERS.noProfile.email, SEED_PASSWORD);

    const profile = await getUserProfile(session.uid);

    expect(profile).toBeNull();
    expect(needsTermsAcceptance(profile)).toBe(true);
  });

  it('creates the missing profile, named after the session, once the person accepts', async () => {
    const session = await signIn(SEED_USERS.noProfile.email, SEED_PASSWORD);

    await acceptLegalDocuments(session.uid);

    const profile = await getUserProfile(session.uid);
    expect(profile).toMatchObject({
      displayName: SEED_USERS.noProfile.displayName,
      terms: { version: TERMS_VERSION },
      privacy: { version: PRIVACY_VERSION },
    });
    expect(needsTermsAcceptance(profile)).toBe(false);
  });

  // PLAN 2.11: only the pending text is renewed; the other keeps the date it was accepted.
  it('renews the pending text of an account that already has a profile, and only that one', async () => {
    const session = await signIn(SEED_USERS.customer.email, SEED_PASSWORD);
    await rewindAcceptance(session.uid, 'privacy', BEHIND_IN_PRIVACY);
    const before = await getUserProfile(session.uid);

    await acceptLegalDocuments(session.uid, { displayName: 'Ignorado', phone: null });

    const renewed = await getUserProfile(session.uid);
    expect(needsTermsAcceptance(before)).toBe(true);
    expect(needsTermsAcceptance(renewed)).toBe(false);
    expect(renewed?.terms).toEqual(before?.terms);
    expect(renewed?.privacy?.acceptedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());
    expect(renewed?.displayName).toBe(SEED_USERS.customer.displayName);
  });

  it('changes no date when the account has nothing pending', async () => {
    const session = await signIn(SEED_USERS.ownerB.email, SEED_PASSWORD);
    const before = await getUserProfile(session.uid);

    await acceptLegalDocuments(session.uid);

    expect(await getUserProfile(session.uid)).toEqual(before);
  });

  it('still answers to its old name', async () => {
    const session = await signIn(SEED_USERS.dispatcherA.email, SEED_PASSWORD);
    await rewindAcceptance(session.uid, 'privacy', BEHIND_IN_PRIVACY);
    const seededAt = (await getUserProfile(session.uid))?.privacy?.acceptedAt.getTime() ?? 0;

    await acceptCurrentTerms(session.uid);

    const renewedAt = (await getUserProfile(session.uid))?.privacy?.acceptedAt.getTime() ?? 0;
    expect(renewedAt).toBeGreaterThan(seededAt);
  });

  it('refuses to accept in the name of another account', async () => {
    await signIn(SEED_USERS.customer.email, SEED_PASSWORD);

    await expect(acceptLegalDocuments(SEED_USERS.noProfile.uid)).rejects.toMatchObject({
      code: 'notSignedIn',
    });
  });
});

// PLAN 2.9: "No acepto: eliminar mi cuenta".
describe('discardUnacceptedAccount', () => {
  it('refuses an account that already has a profile, and leaves it signed in', async () => {
    const session = await signIn(SEED_USERS.customer.email, SEED_PASSWORD);

    await expect(discardUnacceptedAccount(session.uid)).rejects.toBeInstanceOf(AccountInUseError);

    expect(currentSession()?.uid).toBe(session.uid);
    expect(await getUserProfile(session.uid)).not.toBeNull();
  });

  it('refuses to act on any account other than the signed-in one', async () => {
    await signIn(SEED_USERS.customer.email, SEED_PASSWORD);

    await expect(discardUnacceptedAccount(SEED_USERS.unverified.uid)).rejects.toMatchObject({
      code: 'notSignedIn',
    });
  });

  it('removes an account that never accepted: it can no longer sign in', async () => {
    const fresh = await registerWithEmail({
      email: 'no-acepta@example.com',
      password: SEED_PASSWORD,
    });

    await discardUnacceptedAccount(fresh.uid);

    expect(currentSession()).toBeNull();
    await expect(signIn('no-acepta@example.com', SEED_PASSWORD)).rejects.toThrow();
  });

  it('forgets what a registration typed when the account is discarded before verifying', async () => {
    const fresh = await registerAccount({ ...REGISTRATION, email: 'se-arrepiente@example.com' });
    expect(tabStorage.getItem(PENDING_PROFILE_KEY)).not.toBeNull();

    await discardUnacceptedAccount(fresh.uid);

    expect(tabStorage.getItem(PENDING_PROFILE_KEY)).toBeNull();
  });
});

describe('terms, authority and verification data when founding a distributor', () => {
  const founder = async () => {
    const session = await signIn(REGISTRATION.email, REGISTRATION.password);
    return session;
  };

  it.each([
    ['the terms', { acceptTerms: unticked }, ['acceptTerms']],
    ['the authority declaration', { declaresAuthority: unticked }, ['declaresAuthority']],
    [
      'both',
      { acceptTerms: unticked, declaresAuthority: unticked },
      ['acceptTerms', 'declaresAuthority'],
    ],
    // PLAN 2.11
    ['the RUC', { taxId: '' }, ['taxId']],
    ['a RUC with the right check digit', { taxId: '20000000002' }, ['taxId']],
    ['the legal name', { legalName: ' ' }, ['legalName']],
    ['the record number', { hydrocarbonsRegistry: '' }, ['hydrocarbonsRegistry']],
  ])('founds nothing without %s', async (_case, change, expected) => {
    const session = await founder();

    const failure = await foundDistributor(session, { ...FOUNDING, ...change }).catch(
      (error: unknown) => error,
    );

    expect(fieldsOf(failure)).toEqual(expected);
    expect((await getUserProfile(session.uid))?.ownedDistributorIds).toEqual([]);
  });

  it('reports form problems and missing declarations together', async () => {
    const session = await founder();
    const broken = { ...FOUNDING, name: '', declaresAuthority: unticked };

    const failure = await foundDistributor(session, broken).catch((error: unknown) => error);

    expect(fieldsOf(failure)).toEqual(['name', 'declaresAuthority']);
  });

  it('stores the acceptance, the declaration and the verification data in the private settings', async () => {
    const session = await founder();

    const id = await foundDistributor(session, FOUNDING);

    const settings = await getDistributorPrivateSettings(id);
    expect(settings?.terms?.version).toBe(TERMS_VERSION);
    expect(settings?.authorityDeclaredAt).toBeInstanceOf(Date);
    expect(settings?.terms?.acceptedAt).toEqual(settings?.authorityDeclaredAt);
    expect(settings).toMatchObject({
      taxId: FOUNDING.taxId,
      legalName: FOUNDING.legalName,
      hydrocarbonsRegistry: FOUNDING.hydrocarbonsRegistry,
    });
  });

  // PLAN 2.11
  it('leaves the new distributor waiting for its review: only its staff sees it', async () => {
    const session = await founder();
    const [owned] = (await getUserProfile(session.uid))?.ownedDistributorIds ?? [];

    expect(await getStaffDistributor(owned ?? '')).toMatchObject({
      acceptingOrders: false,
      listingApproved: false,
    });
    expect(await getDistributorBySlug(FOUNDING.slug)).toMatchObject({ name: FOUNDING.name });
    await signOut();
    expect(await getDistributorBySlug(FOUNDING.slug)).toBeNull();
  });
});
