import { describe, expect, it } from 'vitest';
import type { Session } from '../../domain/auth/session';
import type { Distributor, Member } from '../../domain/tenancy/types';
import type { CurrentDistributor } from '../tenancy/use-current-distributor';
import { accessInputFor } from './access-input';
import type { AccountGateValue } from './account-context';

const reload = () => {};
const SESSION: Session = {
  uid: 'u1',
  email: 'persona@example.com',
  emailVerified: true,
  displayName: 'Persona Demo',
  providerIds: ['password'],
};
const DRIVER = { uid: 'u1', distributorId: 'd1', role: 'driver', active: true } as Member;

function readyAs(membership: Member): CurrentDistributor {
  return {
    status: 'ready',
    memberships: [membership],
    membership,
    distributor: { id: membership.distributorId } as Distributor,
    isWritable: true,
    listing: 'listed',
    select: () => {},
    reload,
  };
}

function account(patch: Partial<AccountGateValue> = {}): AccountGateValue {
  return {
    session: { status: 'signedIn', session: SESSION },
    profile: { status: 'ready', data: { profile: null, needsTermsAcceptance: true }, reload },
    current: { status: 'none', memberships: [], reload },
    platformAdmin: { status: 'ready', data: false, reload },
    ...patch,
  };
}

describe('accessInputFor', () => {
  it('passes the gate and the session through', () => {
    const input = accessInputFor('office', account());

    expect(input.gate).toBe('office');
    expect(input.session).toEqual({ status: 'signedIn', session: SESSION });
  });

  it('reports the pending terms of an account without a profile', () => {
    expect(accessInputFor('customer', account()).termsPending).toEqual({
      status: 'ready',
      value: true,
    });
  });

  it.each([
    [{ status: 'idle', reload } as const, 'loading'],
    [{ status: 'loading', reload } as const, 'loading'],
    [{ status: 'error', error: new Error('x'), reload } as const, 'error'],
  ])('maps a profile that is %j to %s', (profile, expected) => {
    expect(accessInputFor('customer', account({ profile })).termsPending.status).toBe(expected);
  });

  it('gives a customer no role, and staff the role of the selected distributor', () => {
    expect(accessInputFor('home', account()).role).toEqual({ status: 'ready', value: null });
    expect(accessInputFor('home', account({ current: readyAs(DRIVER) })).role).toEqual({
      status: 'ready',
      value: 'driver',
    });
  });

  // PLAN 2.9: switching distributor must not drop the area to a skeleton.
  it('already knows the role while the chosen distributor is still loading', () => {
    const current: CurrentDistributor = {
      status: 'loading',
      membership: DRIVER,
      memberships: [DRIVER],
    };

    expect(accessInputFor('driver', account({ current })).role).toEqual({
      status: 'ready',
      value: 'driver',
    });
  });

  it.each([
    [{ status: 'idle' } as const, 'loading'],
    [{ status: 'loading' } as const, 'loading'],
    [{ status: 'error', error: new Error('x'), reload } as const, 'error'],
  ])('maps memberships that are %j to %s', (current, expected) => {
    expect(accessInputFor('home', account({ current })).role.status).toBe(expected);
  });

  it.each([
    [{ status: 'idle', reload } as const, { status: 'loading' }],
    [{ status: 'error', error: new Error('x'), reload } as const, { status: 'error' }],
    [{ status: 'ready', data: true, reload } as const, { status: 'ready', value: true }],
  ])('maps the admin check %j', (platformAdmin, expected) => {
    expect(accessInputFor('platform', account({ platformAdmin })).isPlatformAdmin).toEqual(
      expected,
    );
  });
});
