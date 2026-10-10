import { describe, expect, it } from 'vitest';
import {
  activeMemberships,
  hasAnyRole,
  pickCurrentMembership,
  sortMemberships,
} from './membership';
import { type Member, type MemberRole, OFFICE_ROLES } from './types';

const AT = new Date('2026-03-10T15:00:00Z');

function member(distributorId: string, role: MemberRole, active = true): Member {
  return {
    uid: 'u1',
    distributorId,
    role,
    active,
    displayName: 'A. Persona',
    createdAt: AT,
    updatedAt: AT,
  };
}

describe('activeMemberships', () => {
  it('drops deactivated memberships', () => {
    const list = [member('a', 'owner'), member('b', 'driver', false)];
    expect(activeMemberships(list).map((m) => m.distributorId)).toEqual(['a']);
  });
});

describe('sortMemberships', () => {
  it('puts owner first, then dispatcher, then driver, then by id', () => {
    const list = [
      member('z', 'driver'),
      member('b', 'owner'),
      member('m', 'dispatcher'),
      member('a', 'owner'),
    ];
    expect(sortMemberships(list).map((m) => m.distributorId)).toEqual(['a', 'b', 'm', 'z']);
  });
});

describe('pickCurrentMembership', () => {
  const list = [member('a', 'driver'), member('b', 'owner'), member('c', 'dispatcher', false)];

  it('keeps the remembered distributor when the account still belongs to it', () => {
    expect(pickCurrentMembership(list, 'a')?.distributorId).toBe('a');
  });

  it('falls back to the first usable membership when nothing is remembered', () => {
    expect(pickCurrentMembership(list, null)?.distributorId).toBe('b');
  });

  it('ignores a remembered distributor the account no longer belongs to', () => {
    expect(pickCurrentMembership(list, 'gone')?.distributorId).toBe('b');
  });

  it('ignores a remembered distributor where the member was deactivated', () => {
    expect(pickCurrentMembership(list, 'c')?.distributorId).toBe('b');
  });

  it('returns null without usable memberships', () => {
    expect(pickCurrentMembership([], 'a')).toBeNull();
    expect(pickCurrentMembership([member('a', 'owner', false)], 'a')).toBeNull();
  });
});

describe('hasAnyRole', () => {
  it.each([
    ['owner', true, true],
    ['dispatcher', true, true],
    ['driver', true, false],
    ['owner', false, false],
  ] as const)('%s (active %s) in the office → %s', (role, active, expected) => {
    expect(hasAnyRole(member('a', role, active), OFFICE_ROLES)).toBe(expected);
  });

  it('is false without a membership', () => {
    expect(hasAnyRole(null, OFFICE_ROLES)).toBe(false);
  });
});
