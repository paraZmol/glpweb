import { describe, expect, it } from 'vitest';
import {
  acceptanceEntryId,
  compareVersions,
  CURRENT_LEGAL_VERSIONS,
  needsTermsAcceptance,
  pendingLegalTexts,
  PRIVACY_VERSION,
  PRIVACY_VERSIONS,
  TERMS_VERSION,
  TERMS_VERSIONS,
  textsToAccept,
} from './versions';

const AT = new Date('2026-03-10T15:00:00Z');

describe('versions', () => {
  it('lists the current terms version last', () => {
    expect(TERMS_VERSIONS.at(-1)).toBe(TERMS_VERSION);
    expect(PRIVACY_VERSIONS.at(-1)).toBe(PRIVACY_VERSION);
  });
});

describe('compareVersions', () => {
  it.each([
    ['0.1', '0.1', 0],
    ['0.1', '0.2', -1],
    ['0.10', '0.9', 1],
    ['1.0', '0.9', 1],
    ['1', '1.0', 0],
    ['1.0.1', '1.0', 1],
  ])('%s vs %s → sign %i', (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b))).toBe(sign);
  });
});

const current = { version: TERMS_VERSION, acceptedAt: AT };
const currentPrivacy = { version: PRIVACY_VERSION, acceptedAt: AT };
const old = { version: '0.0', acceptedAt: AT };

// PLAN 2.9: two consents, terms and privacy.
describe('needsTermsAcceptance', () => {
  it('is true without a profile', () => {
    expect(needsTermsAcceptance(null)).toBe(true);
  });

  it.each([
    ['no acceptance at all', { terms: null, privacy: null }],
    ['the terms only', { terms: current, privacy: null }],
    ['the privacy policy only', { terms: null, privacy: currentPrivacy }],
    ['older terms', { terms: old, privacy: currentPrivacy }],
    ['an older privacy policy', { terms: current, privacy: old }],
  ])('is true for a profile with %s', (_case, profile) => {
    expect(needsTermsAcceptance(profile)).toBe(true);
  });

  it('is false when both current versions are accepted', () => {
    expect(needsTermsAcceptance({ terms: current, privacy: currentPrivacy })).toBe(false);
  });

  it('is false for versions newer than this build knows', () => {
    const newer = { version: '99.0', acceptedAt: AT };
    expect(needsTermsAcceptance({ terms: newer, privacy: newer })).toBe(false);
  });
});

// PLAN 2.11: renewing one text leaves the date of the other alone.
describe('textsToAccept', () => {
  it.each([
    ['both for an account without a profile', null, ['terms', 'privacy']],
    ['both when neither was accepted', { terms: null, privacy: null }, ['terms', 'privacy']],
    ['only the privacy policy', { terms: current, privacy: old }, ['privacy']],
    ['only the terms', { terms: old, privacy: currentPrivacy }, ['terms']],
    ['nothing when both are current', { terms: current, privacy: currentPrivacy }, []],
  ])('asks for %s', (_case, held, expected) => {
    expect(textsToAccept(held)).toEqual(expected);
  });

  it('compares against the versions it is given, not only the current ones', () => {
    const next = { ...CURRENT_LEGAL_VERSIONS, privacyVersion: '99.0' };

    expect(textsToAccept({ terms: current, privacy: currentPrivacy }, next)).toEqual(['privacy']);
  });

  it('never asks to go back to a version older than the one held', () => {
    const newer = { version: '99.0', acceptedAt: AT };

    expect(textsToAccept({ terms: newer, privacy: newer })).toEqual([]);
  });
});

describe('acceptanceEntryId', () => {
  it('names the entry after the text and its version', () => {
    expect(acceptanceEntryId('terms', '0.2')).toBe('terms-0.2');
    expect(acceptanceEntryId('privacy', '1.10')).toBe('privacy-1.10');
  });
});

describe('pendingLegalTexts', () => {
  it('says which text is missing, so the screen asks only for that one', () => {
    expect(pendingLegalTexts({ terms: current, privacy: null })).toEqual({
      terms: false,
      privacy: true,
    });
    expect(pendingLegalTexts(null)).toEqual({ terms: true, privacy: true });
  });
});
