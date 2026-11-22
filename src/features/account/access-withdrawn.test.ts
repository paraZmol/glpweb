import { describe, expect, it } from 'vitest';
import type { Member } from '../../domain/tenancy/types';
import type { CurrentDistributor } from '../tenancy/use-current-distributor';
import { withdrawnAccessOf, withdrawnNoticeOf } from './access-withdrawn';
import type { AccountGateValue } from './account-context';

const reload = () => {};
const OFF = {
  uid: 'u1',
  distributorId: 'd1',
  role: 'driver',
  active: false,
  distributorName: 'Gas Demo Norte',
} as Member;

function withCurrent(current: CurrentDistributor): AccountGateValue {
  return {
    session: { status: 'loading' },
    profile: { status: 'loading', reload },
    current,
    platformAdmin: { status: 'ready', data: false, reload },
  };
}

const none = (memberships: Member[]) => withCurrent({ status: 'none', memberships, reload });

// PLAN 3.2, role walker fourth pass: a person switched off is told so, not "not for you".
describe('withdrawnAccessOf', () => {
  it.each(['driver', 'office'] as const)('names the distributor that switched off a %s', (gate) => {
    expect(withdrawnAccessOf(gate, none([OFF]))).toBe('Gas Demo Norte');
  });

  it('falls back to a generic name for a membership without a copied name', () => {
    expect(withdrawnAccessOf('driver', none([{ ...OFF, distributorName: '' }]))).toBe(
      'tu distribuidora',
    );
  });

  it('says nothing for a customer that never worked anywhere', () => {
    expect(withdrawnAccessOf('driver', none([]))).toBeNull();
  });

  it('says nothing for the platform panel', () => {
    expect(withdrawnAccessOf('platform', none([OFF]))).toBeNull();
  });

  it('says nothing while the account still works somewhere', () => {
    const loading = withCurrent({ status: 'loading' });
    expect(withdrawnAccessOf('office', loading)).toBeNull();
  });

  it('writes the notice with the name and what to do', () => {
    expect(withdrawnNoticeOf('Gas Demo Norte')).toMatch(
      /^Ya no tienes acceso a Gas Demo Norte: .*habla con su titular\.$/,
    );
  });
});
