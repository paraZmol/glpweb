import { describe, expect, it } from 'vitest';
import { canFoundDistributor, hasSessionEnded, leftDataBehind, type Session } from './session';

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

describe('canFoundDistributor', () => {
  const session: Session = {
    uid: 'u1',
    email: 'a@example.com',
    emailVerified: true,
    displayName: null,
    providerIds: ['google.com'],
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
