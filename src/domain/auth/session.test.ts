import { describe, expect, it } from 'vitest';
import {
  canFoundDistributor,
  hasSessionEnded,
  isAcceptablePassword,
  isValidEmail,
  leftDataBehind,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  type Session,
} from './session';

describe('leftDataBehind (PLAN 2.11)', () => {
  const START = { isFirstState: true, isSignedIn: false, hasLocalSessionData: true };

  it('is true when the app starts signed out over the data of a session', () => {
    expect(leftDataBehind(START)).toBe(true);
  });

  it.each([
    ['somebody is signed in', { isSignedIn: true }],
    ['the device holds no session data', { hasLocalSessionData: false }],
    ['it is not the first state of the page load', { isFirstState: false }],
  ])('is false when %s', (_case, change) => {
    expect(leftDataBehind({ ...START, ...change })).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Persona@Example.COM ')).toBe('persona@example.com');
  });
});

describe('isValidEmail', () => {
  it.each(['a@example.com', 'a.b+c@example.org'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'a', 'a@', '@example.com', 'a@example', 'a b@example.com', 'a@@example.com'])(
    'rejects "%s"',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );

  it('rejects an address longer than a mailbox can be', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });
});

describe('isAcceptablePassword', () => {
  it('accepts the minimum length', () => {
    expect(isAcceptablePassword('x'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });

  it.each(['', 'x'.repeat(MIN_PASSWORD_LENGTH - 1), 'x'.repeat(5000)])('rejects length %#', (p) => {
    expect(isAcceptablePassword(p)).toBe(false);
  });
});

describe('canFoundDistributor', () => {
  const session: Session = {
    uid: 'u1',
    email: 'a@example.com',
    emailVerified: true,
    displayName: null,
    providerIds: ['password'],
  };

  it('needs a verified e-mail', () => {
    expect(canFoundDistributor(session)).toBe(true);
    expect(canFoundDistributor({ ...session, emailVerified: false })).toBe(false);
    expect(canFoundDistributor({ ...session, email: null })).toBe(false);
  });
});

// PLAN 2.9: a tab clears its local data whenever the account it was showing is gone.
describe('hasSessionEnded', () => {
  it.each([
    ['signing out', 'u1', null, true],
    ['another account taking its place', 'u1', 'u2', true],
    ['the first sign-in', null, 'u1', false],
    ['a token renewal of the same account', 'u1', 'u1', false],
    ['staying signed out', null, null, false],
  ])('%s → %s', (_case, previous, next, expected) => {
    expect(hasSessionEnded(previous, next)).toBe(expected);
  });
});
