import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  needsTermsAcceptance,
  PRIVACY_VERSION,
  TERMS_VERSION,
  TERMS_VERSIONS,
} from './versions';

const AT = new Date('2026-03-10T15:00:00Z');

describe('versions', () => {
  it('lists the current terms version last', () => {
    expect(TERMS_VERSIONS.at(-1)).toBe(TERMS_VERSION);
    expect(PRIVACY_VERSION).toMatch(/^\d+\.\d+$/);
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

describe('needsTermsAcceptance', () => {
  it('is true without a profile', () => {
    expect(needsTermsAcceptance(null)).toBe(true);
  });

  it('is true for a profile without an acceptance', () => {
    expect(needsTermsAcceptance({ terms: null })).toBe(true);
  });

  it('is true for an older version', () => {
    expect(needsTermsAcceptance({ terms: { version: '0.0', acceptedAt: AT } })).toBe(true);
  });

  it('is false for the current version', () => {
    expect(needsTermsAcceptance({ terms: { version: TERMS_VERSION, acceptedAt: AT } })).toBe(false);
  });

  it('is false for a version newer than this build knows', () => {
    expect(needsTermsAcceptance({ terms: { version: '99.0', acceptedAt: AT } })).toBe(false);
  });
});
