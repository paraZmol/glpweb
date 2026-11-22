import { describe, expect, it } from 'vitest';
import type { Validated } from '../tenancy/field-checks';
import { INVITE_EMAIL_MAX_LENGTH } from './constants';
import {
  AlreadyMemberError,
  InviteExpiredError,
  InviteForAnotherAccountError,
  InviteRevokedError,
  InviteUsedError,
} from './errors';
import type { Invite } from './invite';
import { inviteRefusalFor, normalizeInviteEmail, prepareInvite } from './invite-input';

const FOUNDER = { isFounder: true };
const CO_OWNER = { isFounder: false };

const issuesOf = (result: Validated<unknown>) =>
  result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);

describe('prepareInvite', () => {
  it.each(['dispatcher', 'driver'] as const)('lets any owner invite a %s by link', (role) => {
    expect(prepareInvite({ role }, CO_OWNER)).toEqual({ ok: true, value: { role, email: null } });
  });

  it('ties the invitation to an address, trimmed and in lowercase', () => {
    const result = prepareInvite({ role: 'driver', email: '  C.Persona@Example.com ' }, CO_OWNER);
    expect(result.ok && result.value.email).toBe('c.persona@example.com');
  });

  it('lets the founder invite an owner tied to an address', () => {
    const result = prepareInvite({ role: 'owner', email: 'socia@example.com' }, FOUNDER);
    expect(result).toEqual({ ok: true, value: { role: 'owner', email: 'socia@example.com' } });
  });

  it('refuses an owner invitation from an owner who is not the founder', () => {
    const result = prepareInvite({ role: 'owner', email: 'socia@example.com' }, CO_OWNER);
    expect(issuesOf(result)).toEqual(['role:founderOnly']);
  });

  it('refuses an owner invitation without an address, even from the founder', () => {
    expect(issuesOf(prepareInvite({ role: 'owner', email: ' ' }, FOUNDER))).toEqual([
      'email:required',
    ]);
  });

  it.each([
    ['without an @', 'persona.example.com'],
    ['with two @', 'a@b@example.com'],
    ['without a dot after the @', 'persona@example'],
    ['with a space inside', 'una persona@example.com'],
  ])('refuses an address %s', (_case, email) => {
    expect(issuesOf(prepareInvite({ role: 'driver', email }, FOUNDER))).toEqual(['email:invalid']);
  });

  it('refuses an address longer than the limit', () => {
    const email = `${'a'.repeat(INVITE_EMAIL_MAX_LENGTH)}@example.com`;
    expect(issuesOf(prepareInvite({ role: 'driver', email }, FOUNDER))).toEqual(['email:tooLong']);
  });

  it('refuses a role that does not exist', () => {
    const role = 'boss' as unknown as 'driver';
    expect(issuesOf(prepareInvite({ role }, FOUNDER))).toEqual(['role:invalid']);
  });
});

describe('normalizeInviteEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeInviteEmail(' A@Example.COM ')).toBe('a@example.com');
  });
});

describe('inviteRefusalFor', () => {
  const NOW = new Date('2026-10-03T12:00:00Z');
  const JOINER = { uid: 'newbie', email: 'Newbie@example.com' };
  const invite = (change: Partial<Invite> = {}): Invite => ({
    id: 'Ab3dEf6hIj9lMn2pQr5t',
    distributorId: 'dist-a',
    role: 'driver',
    email: null,
    distributorName: 'Gas Demo',
    invitedByName: null,
    brandColor: null,
    status: 'pending',
    createdBy: 'owner-a',
    createdAt: new Date('2026-10-01T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z'),
    acceptedBy: null,
    acceptedAt: null,
    revokedBy: null,
    revokedAt: null,
    ...change,
  });

  it('lets anybody with the link use an invitation that names nobody', () => {
    expect(inviteRefusalFor(invite(), JOINER, NOW)).toBeNull();
  });

  it('lets the named account use it, whatever the case of its address', () => {
    expect(inviteRefusalFor(invite({ email: 'newbie@example.com' }), JOINER, NOW)).toBeNull();
  });

  it.each([
    [
      'used by another account',
      invite({ status: 'accepted', acceptedBy: 'other' }),
      InviteUsedError,
    ],
    [
      'used by this same account',
      invite({ status: 'accepted', acceptedBy: 'newbie' }),
      AlreadyMemberError,
    ],
    ['revoked', invite({ status: 'revoked' }), InviteRevokedError],
    ['expired', invite({ createdAt: new Date('2026-09-20T12:00:00Z') }), InviteExpiredError],
    ['for another account', invite({ email: 'otra@example.com' }), InviteForAnotherAccountError],
  ] as const)('refuses one %s', (_case, value, error) => {
    expect(inviteRefusalFor(value, JOINER, NOW)).toBeInstanceOf(error);
  });
});
