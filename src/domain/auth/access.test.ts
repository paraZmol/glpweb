import { describe, expect, it } from 'vitest';
import type { MemberRole } from '../tenancy/types';
import {
  type AccessGate,
  type AccessInput,
  APP_AREAS,
  areaForRole,
  decideAccess,
  type Loadable,
} from './access';
import type { Session, SessionState } from './session';

const SESSION: Session = {
  uid: 'u1',
  email: 'persona@example.com',
  emailVerified: true,
  displayName: 'Persona Demo',
  photoUrl: null,
  providerIds: ['password'],
};

const ready = <T>(value: T): Loadable<T> => ({ status: 'ready', value });
const LOADING = { status: 'loading' } as const;
const FAILED = { status: 'error' } as const;
const signedIn = (patch: Partial<Session> = {}): SessionState => ({
  status: 'signedIn',
  session: { ...SESSION, ...patch },
});

function input(gate: AccessGate, patch: Partial<AccessInput> = {}): AccessInput {
  return {
    gate,
    session: signedIn(),
    termsPending: ready(false),
    role: ready<MemberRole | null>(null),
    isPlatformAdmin: ready(false),
    ...patch,
  };
}

const ALL_GATES: AccessGate[] = [...APP_AREAS, 'acceptTerms', 'verifyEmail', 'home'];
const home = (area: string, denied = false) => ({ kind: 'redirect', to: 'area', area, denied });

describe('decideAccess: the steps before any area (PLAN 2.4)', () => {
  it.each(ALL_GATES)('waits on %s while the session is being restored', (gate) => {
    expect(decideAccess(input(gate, { session: LOADING }))).toEqual({ kind: 'wait' });
  });

  it.each(ALL_GATES)('sends a signed-out visitor of %s to sign in', (gate) => {
    const decision = decideAccess(input(gate, { session: { status: 'signedOut' } }));

    expect(decision).toEqual({ kind: 'redirect', to: 'signIn' });
  });

  it.each(ALL_GATES)('waits on %s while the profile loads', (gate) => {
    expect(decideAccess(input(gate, { termsPending: LOADING }))).toEqual({ kind: 'wait' });
  });

  it.each(ALL_GATES)('reports the profile error on %s instead of guessing', (gate) => {
    const decision = decideAccess(input(gate, { termsPending: FAILED }));

    expect(decision).toEqual({ kind: 'error', source: 'profile' });
  });

  it.each([...APP_AREAS, 'verifyEmail', 'home'] as AccessGate[])(
    'asks for the terms before %s, even to an owner or an admin',
    (gate) => {
      const decision = decideAccess(
        input(gate, {
          termsPending: ready(true),
          role: ready('owner'),
          isPlatformAdmin: ready(true),
        }),
      );

      expect(decision).toEqual({ kind: 'redirect', to: 'acceptTerms' });
    },
  );

  it('asks for the terms before the e-mail verification', () => {
    const decision = decideAccess(
      input('customer', { termsPending: ready(true), session: signedIn({ emailVerified: false }) }),
    );

    expect(decision).toEqual({ kind: 'redirect', to: 'acceptTerms' });
  });

  it.each([...APP_AREAS, 'home'] as AccessGate[])('asks to verify the e-mail before %s', (gate) => {
    const decision = decideAccess(
      input(gate, { session: signedIn({ emailVerified: false }), role: ready('owner') }),
    );

    expect(decision).toEqual({ kind: 'redirect', to: 'verifyEmail' });
  });

  it('shows the terms step only while it is pending', () => {
    expect(decideAccess(input('acceptTerms', { termsPending: ready(true) }))).toEqual({
      kind: 'allow',
    });
    expect(decideAccess(input('acceptTerms'))).toEqual(home('customer'));
  });

  it('shows the verification step only while it is pending', () => {
    const unverified = signedIn({ emailVerified: false });

    expect(decideAccess(input('verifyEmail', { session: unverified }))).toEqual({ kind: 'allow' });
    expect(decideAccess(input('verifyEmail', { role: ready('driver') }))).toEqual(home('driver'));
  });
});

describe('decideAccess: areas by role', () => {
  const ROLES: (MemberRole | null)[] = ['owner', 'dispatcher', 'driver', null];

  it.each(ROLES)('lets role %s into the customer area', (role) => {
    expect(decideAccess(input('customer', { role: ready(role) }))).toEqual({ kind: 'allow' });
  });

  it('lets a customer in without waiting for memberships or admin', () => {
    const decision = decideAccess(input('customer', { role: LOADING, isPlatformAdmin: FAILED }));

    expect(decision).toEqual({ kind: 'allow' });
  });

  it.each([
    ['office', 'owner', { kind: 'allow' }],
    ['office', 'dispatcher', { kind: 'allow' }],
    ['office', 'driver', home('driver', true)],
    ['office', null, home('customer', true)],
    ['driver', 'driver', { kind: 'allow' }],
    ['driver', 'owner', home('office', true)],
    ['driver', 'dispatcher', home('office', true)],
    ['driver', null, home('customer', true)],
  ] as const)('gate %s with role %s', (gate, role, expected) => {
    expect(decideAccess(input(gate, { role: ready(role) }))).toEqual(expected);
  });

  it.each(['office', 'driver'] as const)('waits on %s while memberships load', (gate) => {
    expect(decideAccess(input(gate, { role: LOADING }))).toEqual({ kind: 'wait' });
  });

  it.each(['office', 'driver', 'home'] as const)(
    'reports a membership error on %s instead of treating the account as a customer',
    (gate) => {
      const decision = decideAccess(input(gate, { role: FAILED }));

      expect(decision).toEqual({ kind: 'error', source: 'membership' });
    },
  );

  it('sends an admin who is not staff out of the office to the platform panel', () => {
    const decision = decideAccess(input('office', { isPlatformAdmin: ready(true) }));

    expect(decision).toEqual(home('platform', true));
  });

  it('never lets the office gate pass on the admin flag alone', () => {
    const decision = decideAccess(input('driver', { isPlatformAdmin: ready(true) }));

    expect(decision.kind).toBe('redirect');
  });
});

describe('decideAccess: platform area', () => {
  it('lets a platform admin in', () => {
    expect(decideAccess(input('platform', { isPlatformAdmin: ready(true) }))).toEqual({
      kind: 'allow',
    });
  });

  it.each(['owner', 'dispatcher', 'driver', null] as const)(
    'keeps role %s out when it is not an admin',
    (role) => {
      const decision = decideAccess(input('platform', { role: ready(role) }));

      expect(decision).toEqual(home(areaForRole(role), true));
    },
  );

  it('waits while the admin check loads and reports its error', () => {
    expect(decideAccess(input('platform', { isPlatformAdmin: LOADING }))).toEqual({ kind: 'wait' });
    expect(decideAccess(input('platform', { isPlatformAdmin: FAILED }))).toEqual({
      kind: 'error',
      source: 'platform',
    });
  });
});

describe('decideAccess: landing after signing in', () => {
  it.each([
    ['owner', false, 'office'],
    ['dispatcher', false, 'office'],
    ['driver', false, 'driver'],
    ['owner', true, 'office'],
    [null, true, 'platform'],
    [null, false, 'customer'],
  ] as const)('role %s, admin %s → %s', (role, isAdmin, area) => {
    const decision = decideAccess(
      input('home', { role: ready(role), isPlatformAdmin: ready(isAdmin) }),
    );

    expect(decision).toEqual(home(area));
  });

  it('waits for the admin check only when the account has no role', () => {
    expect(decideAccess(input('home', { isPlatformAdmin: LOADING }))).toEqual({ kind: 'wait' });
    expect(
      decideAccess(input('home', { role: ready('driver'), isPlatformAdmin: LOADING })),
    ).toEqual(home('driver'));
  });

  it('lands a customer at home when the admin check fails', () => {
    expect(decideAccess(input('home', { isPlatformAdmin: FAILED }))).toEqual(home('customer'));
  });
});
