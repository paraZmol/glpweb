import { describe, expect, it } from 'vitest';
import { INVITE_TTL_DAYS } from './constants';
import {
  type Invite,
  inviteExpiresAt,
  inviteLinkOf,
  inviteStateOf,
  isInviteCode,
  isInviteExpired,
  parseInviteFragment,
} from './invite';

const CREATED = new Date('2026-10-01T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const CODE = 'Ab3dEf6hIj9lMn2pQr5t';

const invite = (change: Partial<Invite> = {}): Invite => ({
  id: CODE,
  distributorId: 'dist-a',
  role: 'driver',
  email: null,
  distributorName: 'Gas Demo',
  status: 'pending',
  createdBy: 'owner-a',
  createdAt: CREATED,
  updatedAt: CREATED,
  acceptedBy: null,
  acceptedAt: null,
  revokedBy: null,
  revokedAt: null,
  ...change,
});

const after = (ms: number) => new Date(CREATED.getTime() + ms);

describe('inviteExpiresAt', () => {
  it(`ends ${INVITE_TTL_DAYS} days after the invitation was created`, () => {
    expect(inviteExpiresAt(invite())).toEqual(after(INVITE_TTL_DAYS * DAY));
  });
});

describe('isInviteExpired', () => {
  it('still works one millisecond before the end', () => {
    expect(isInviteExpired(invite(), after(INVITE_TTL_DAYS * DAY - 1))).toBe(false);
  });

  it('stops working at the very end, like the rules (createdAt + 7 days > now)', () => {
    expect(isInviteExpired(invite(), after(INVITE_TTL_DAYS * DAY))).toBe(true);
  });
});

describe('inviteStateOf', () => {
  it.each([
    ['a pending one within its days', invite(), after(DAY), 'usable'],
    ['a pending one past its days', invite(), after(8 * DAY), 'expired'],
    [
      'an accepted one, even past its days',
      invite({ status: 'accepted' }),
      after(9 * DAY),
      'accepted',
    ],
    ['a revoked one, even within its days', invite({ status: 'revoked' }), after(DAY), 'revoked'],
  ] as const)('calls %s %s', (_case, value, now, state) => {
    expect(inviteStateOf(value, now)).toBe(state);
  });
});

describe('isInviteCode', () => {
  it('accepts twenty letters and digits, as Firestore generates them', () => {
    expect(isInviteCode(CODE)).toBe(true);
  });

  it.each([
    ['a shorter code', CODE.slice(1)],
    ['a longer code', `${CODE}x`],
    ['a code with a hyphen', `${CODE.slice(1)}-`],
    ['a path', `${CODE.slice(2)}/x`],
    ['the empty text', ''],
  ])('refuses %s', (_case, code) => {
    expect(isInviteCode(code)).toBe(false);
  });
});

describe('invitation links', () => {
  const BASE = 'https://example.com/unirme';

  it('keeps the two ids in the fragment, which never reaches a server', () => {
    const link = inviteLinkOf(BASE, { distributorId: 'dist-a', code: CODE });
    expect(link).toBe(`${BASE}#d=dist-a&c=${CODE}`);
    expect(new URL(link).search).toBe('');
  });

  it('reads back what it wrote, with or without the #', () => {
    const ref = { distributorId: 'dist-a', code: CODE };
    const hash = new URL(inviteLinkOf(BASE, ref)).hash;
    expect(parseInviteFragment(hash)).toEqual(ref);
    expect(parseInviteFragment(hash.slice(1))).toEqual(ref);
  });

  it.each([
    ['an empty fragment', ''],
    ['a missing code', '#d=dist-a'],
    ['a code of another shape', '#d=dist-a&c=abc'],
    ['a distributor id with a slash', `#d=dist/a&c=${CODE}`],
    ['a missing distributor', `#c=${CODE}`],
  ])('refuses %s', (_case, hash) => {
    expect(parseInviteFragment(hash)).toBeNull();
  });
});
