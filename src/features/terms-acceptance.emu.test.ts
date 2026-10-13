import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs, signInAsNewcomer } from '../../tests/support/emulated-session';
import { rewindAcceptance } from '../../tests/support/emulator';
import { currentSession } from '../data/auth-repo';
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
  acceptLegalDocuments,
  discardUnacceptedAccount,
  listLegalAcceptances,
  signOut,
  suggestedProfileOf,
} from './auth/auth-actions';
import { type FoundingInput, foundDistributor } from './tenancy/tenancy-actions';

/** The account that founds at the end of this file: a newcomer that accepts first. */
const FOUNDER = { email: 'acepta-terminos@example.com', displayName: 'P. Acepta' };

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

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOut();
});

// PLAN 2.1, 2.11: the first sign-in creates the account and nothing else. The profile and the
// two consents are created together, when the person accepts.
describe('a first sign-in — nothing is stored until the person accepts', () => {
  it('creates only the sign-in account: no profile, no consent', async () => {
    const session = await signInAsNewcomer('primera-vez@example.com', 'P. Primera');

    expect(session).toMatchObject({ emailVerified: true, displayName: 'P. Primera' });
    expect(await getUserProfile(session.uid)).toBeNull();
    expect(await listLegalAcceptances(session.uid)).toEqual([]);
  });

  it('offers the name Google gave for the person to confirm, and no phone', async () => {
    const session = await signInAsNewcomer('primera-vez@example.com', 'P. Primera');

    expect(suggestedProfileOf(session)).toEqual({ displayName: 'P. Primera', phone: null });
    expect(suggestedProfileOf({ ...session, displayName: null })).toEqual({
      displayName: '',
      phone: null,
    });
  });

  it('refuses the acceptance, and the profile itself, without a confirmed e-mail', async () => {
    const session = await signInAs({
      email: 'sin-confirmar@example.com',
      displayName: 'S. Confirmar',
      emailVerified: false,
    });
    expect(session.emailVerified).toBe(false);

    await expect(acceptLegalDocuments(session.uid)).rejects.toBeInstanceOf(EmailNotVerifiedError);
    await expect(
      createUserProfile(session.uid, { displayName: 'X', phone: null }, CURRENT_LEGAL_VERSIONS),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(await getUserProfile(session.uid)).toBeNull();
  });

  it('creates the profile with both consents and their history from what the step sends', async () => {
    const session = await signInAsNewcomer('confirma-datos@example.com', 'P. De Google');

    await acceptLegalDocuments(session.uid, {
      displayName: ' P. Corregida ',
      phone: '900 000 097',
    });

    const profile = await getUserProfile(session.uid);
    expect(profile).toMatchObject({
      displayName: 'P. Corregida',
      phone: '900000097',
      terms: { version: TERMS_VERSION },
      privacy: { version: PRIVACY_VERSION },
    });
    expect(needsTermsAcceptance(profile)).toBe(false);
    expect((await listLegalAcceptances(session.uid)).map((entry) => entry.id).toSorted()).toEqual([
      `privacy-${PRIVACY_VERSION}`,
      `terms-${TERMS_VERSION}`,
    ]);
    // The session now carries the name the person confirmed, not the one Google gave.
    expect(currentSession()?.displayName).toBe('P. Corregida');
  });

  it('refuses invalid details on the terms step and creates nothing', async () => {
    const session = await signInAsNewcomer('detalles@example.com');

    const failure = await acceptLegalDocuments(session.uid, {
      displayName: '',
      phone: '123',
    }).catch((error: unknown) => error);

    expect(fieldsOf(failure)).toEqual(['displayName', 'phone']);
    expect(await getUserProfile(session.uid)).toBeNull();
  });
});

describe('acceptLegalDocuments', () => {
  it('does not invent a profile for an account that never accepted', async () => {
    const session = await signInAs(SEED_USERS.noProfile);

    const profile = await getUserProfile(session.uid);

    expect(profile).toBeNull();
    expect(needsTermsAcceptance(profile)).toBe(true);
  });

  it('creates the missing profile, named after the session, once the person accepts', async () => {
    const session = await signInAs(SEED_USERS.noProfile);

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
    const session = await signInAs(SEED_USERS.customer);
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
    const session = await signInAs(SEED_USERS.ownerB);
    const before = await getUserProfile(session.uid);

    await acceptLegalDocuments(session.uid);

    expect(await getUserProfile(session.uid)).toEqual(before);
  });

  it('refuses to accept in the name of another account', async () => {
    await signInAs(SEED_USERS.customer);

    await expect(acceptLegalDocuments(SEED_USERS.noProfile.uid)).rejects.toMatchObject({
      code: 'notSignedIn',
    });
  });
});

// PLAN 2.9: "No quiero continuar: eliminar mi cuenta".
describe('discardUnacceptedAccount', () => {
  it('refuses an account that already has a profile, and leaves it signed in', async () => {
    const session = await signInAs(SEED_USERS.customer);

    await expect(discardUnacceptedAccount(session.uid)).rejects.toBeInstanceOf(AccountInUseError);

    expect(currentSession()?.uid).toBe(session.uid);
    expect(await getUserProfile(session.uid)).not.toBeNull();
  });

  it('refuses to act on any account other than the signed-in one', async () => {
    await signInAs(SEED_USERS.customer);

    await expect(discardUnacceptedAccount(SEED_USERS.unverified.uid)).rejects.toMatchObject({
      code: 'notSignedIn',
    });
  });

  it('removes an account that never accepted: coming back starts from nothing', async () => {
    const fresh = await signInAsNewcomer('no-acepta@example.com');

    await discardUnacceptedAccount(fresh.uid);

    expect(currentSession()).toBeNull();
    const again = await signInAsNewcomer('no-acepta@example.com');
    expect(again.uid).not.toBe(fresh.uid);
    expect(await getUserProfile(again.uid)).toBeNull();
  });
});

describe('terms, authority and verification data when founding a distributor', () => {
  const founder = () => signInAs(FOUNDER);

  beforeAll(async () => {
    const session = await founder();
    await acceptLegalDocuments(session.uid, { displayName: FOUNDER.displayName, phone: null });
  });

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
