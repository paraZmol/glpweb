import { describe, expect, it } from 'vitest';
import type { Member } from '../../domain/tenancy/types';
import { namesFromMemberships } from './use-membership-distributor-names';

const AT = new Date('2026-10-10T15:00:00Z');

function membership(distributorId: string, distributorName: string): Member {
  return {
    uid: 'u1',
    distributorId,
    role: 'owner',
    active: true,
    displayName: 'A. Persona',
    distributorName,
    createdAt: AT,
    updatedAt: AT,
  };
}

// PLAN 2.9: the selector takes the names from the memberships, without reading each distributor.
describe('namesFromMemberships', () => {
  it('maps each distributor to the name its membership carries', () => {
    const names = namesFromMemberships([
      membership('d-norte', 'Gas Demo Norte'),
      membership('d-sur', 'Gas Demo Sur'),
    ]);

    expect(names).toEqual({ 'd-norte': 'Gas Demo Norte', 'd-sur': 'Gas Demo Sur' });
  });

  it('leaves out a membership written before the name was copied', () => {
    expect(namesFromMemberships([membership('d-viejo', '')])).toEqual({});
  });

  it('is empty for an account without memberships', () => {
    expect(namesFromMemberships([])).toEqual({});
  });
});
