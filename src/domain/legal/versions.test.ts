import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  needsTermsAcceptance,
  pendingLegalTexts,
  PRIVACY_VERSION,
  PRIVACY_VERSIONS,
  TERMS_VERSION,
  TERMS_VERSIONS,
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

describe('pendingLegalTexts', () => {
  it('says which text is missing, so the screen asks only for that one', () => {
    expect(pendingLegalTexts({ terms: current, privacy: null })).toEqual({
      terms: false,
      privacy: true,
    });
    expect(pendingLegalTexts(null)).toEqual({ terms: true, privacy: true });
  });
});
