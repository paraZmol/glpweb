import { describe, expect, it } from 'vitest';
import type { MemberChangeRequest } from './member-management';
import type { MemberRole } from '../tenancy/types';
import {
  assignableRoles,
  mayStopAnOwner,
  memberChangeOf,
  memberChangeRefusal,
  sortMembers,
  stopsBeingActiveOwner,
} from './member-management';

const FOUNDER = 'founder';
const CO_OWNER = 'co-owner';

const request = (
  actorUid: string,
  target: MemberChangeRequest['target'],
  change: MemberChangeRequest['change'],
): MemberChangeRequest => ({ actorUid, founderUid: FOUNDER, target, change });

describe('memberChangeRefusal', () => {
  it.each([
    [
      'the founder makes a driver a dispatcher',
      FOUNDER,
      { uid: 'd1', role: 'driver' },
      { role: 'dispatcher' },
    ],
    [
      'a co-owner switches a driver off',
      CO_OWNER,
      { uid: 'd1', role: 'driver' },
      { active: false },
    ],
    [
      'a co-owner makes a dispatcher a driver',
      CO_OWNER,
      { uid: 'c1', role: 'dispatcher' },
      { role: 'driver' },
    ],
    [
      'the founder makes a driver an owner',
      FOUNDER,
      { uid: 'd1', role: 'driver' },
      { role: 'owner' },
    ],
    [
      'the founder demotes a co-owner',
      FOUNDER,
      { uid: CO_OWNER, role: 'owner' },
      { role: 'driver' },
    ],
    [
      'the founder switches a co-owner off',
      FOUNDER,
      { uid: CO_OWNER, role: 'owner' },
      { active: false },
    ],
  ] as const)('allows: %s', (_case, actor, target, change) => {
    expect(memberChangeRefusal(request(actor, target, change))).toBeNull();
  });

  it.each([
    [
      'the founder changes itself',
      FOUNDER,
      { uid: FOUNDER, role: 'owner' },
      { active: false },
      'self',
    ],
    [
      'a co-owner demotes itself',
      CO_OWNER,
      { uid: CO_OWNER, role: 'owner' },
      { role: 'driver' },
      'self',
    ],
    [
      'a co-owner demotes the founder',
      CO_OWNER,
      { uid: FOUNDER, role: 'owner' },
      { role: 'driver' },
      'founder',
    ],
    [
      'a co-owner switches the founder off',
      CO_OWNER,
      { uid: FOUNDER, role: 'owner' },
      { active: false },
      'founder',
    ],
    [
      'a co-owner makes a driver an owner',
      CO_OWNER,
      { uid: 'd1', role: 'driver' },
      { role: 'owner' },
      'ownersByFounderOnly',
    ],
    [
      'a co-owner demotes another co-owner',
      CO_OWNER,
      { uid: 'o2', role: 'owner' },
      { role: 'driver' },
      'ownersByFounderOnly',
    ],
    [
      'a co-owner switches another co-owner off',
      CO_OWNER,
      { uid: 'o2', role: 'owner' },
      { active: false },
      'ownersByFounderOnly',
    ],
  ] as const)('refuses: %s', (_case, actor, target, change, reason) => {
    expect(memberChangeRefusal(request(actor, target, change))).toBe(reason);
  });
});

describe('memberChangeOf', () => {
  it('keeps only what changes', () => {
    expect(
      memberChangeOf({ role: 'driver', active: true }, { role: 'driver', active: false }),
    ).toEqual({
      active: false,
    });
  });

  it('is empty when nothing changes', () => {
    expect(memberChangeOf({ role: 'driver', active: true }, { role: 'driver' })).toEqual({});
  });
});

describe('assignableRoles', () => {
  it('offers the owner role only to the founder', () => {
    expect(assignableRoles(true)).toContain('owner');
    expect(assignableRoles(false)).toEqual(['dispatcher', 'driver']);
  });
});

describe('sortMembers', () => {
  const member = (uid: string, role: MemberRole, active: boolean, displayName: string) => ({
    uid,
    role,
    active,
    displayName,
  });

  it('puts the active first, then owners, dispatchers and drivers, then by name', () => {
    const sorted = sortMembers([
      member('u1', 'driver', true, 'Zoe'),
      member('u2', 'owner', false, 'Ana'),
      member('u3', 'driver', true, 'Ángel'),
      member('u4', 'dispatcher', true, 'Beto'),
      member('u5', 'owner', true, 'Carla'),
    ]);

    expect(sorted.map((each) => each.uid)).toEqual(['u5', 'u4', 'u3', 'u1', 'u2']);
  });
});

// PLAN §11 (2026-10-16): the invitations of an owner stop working when it stops being one.
describe('stopsBeingActiveOwner', () => {
  const OWNER = { role: 'owner', active: true } as const;

  it.each([
    ['switched off', OWNER, { active: false }, true],
    ['made a dispatcher', OWNER, { role: 'dispatcher' }, true],
    ['made a driver and switched off', OWNER, { role: 'driver', active: false }, true],
    ['left as it is', OWNER, {}, false],
    [
      'an owner switched off, switched back on',
      { role: 'owner', active: false },
      { active: true },
      false,
    ],
    ['a dispatcher made an owner', { role: 'dispatcher', active: true }, { role: 'owner' }, false],
    ['a driver switched off', { role: 'driver', active: true }, { active: false }, false],
  ] as const)('%s: %s', (_case, current, changed, expected) => {
    expect(stopsBeingActiveOwner(current, changed)).toBe(expected);
  });
});

describe('mayStopAnOwner', () => {
  it.each([
    [{ active: false }, true],
    [{ role: 'dispatcher' }, true],
    [{ role: 'driver' }, true],
    [{ role: 'owner' }, false],
    [{ active: true }, false],
    [{}, false],
  ] as const)('reads %o as %s', (change, expected) => {
    expect(mayStopAnOwner(change)).toBe(expected);
  });
});
