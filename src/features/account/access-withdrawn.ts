import type { AccessGate } from '../../domain/auth/access';
import type { AccountGateValue } from './account-context';

/**
 * The name of the distributor whose access was withdrawn, when that is why the account cannot
 * open a work area: it asks for the panel of the staff or of a driver, it is no longer an active
 * member anywhere, and a membership of it is switched off (PLAN 3.2). Null otherwise: the
 * generic "not for your account" applies.
 */
export function withdrawnAccessOf(gate: AccessGate, { current }: AccountGateValue): string | null {
  if (gate !== 'driver' && gate !== 'office') return null;
  if (current.status !== 'none') return null;
  const switchedOff = current.memberships.find((membership) => !membership.active);
  if (!switchedOff) return null;
  return switchedOff.distributorName || 'tu distribuidora';
}

/** What the person reads when it lands on its home after losing the access. */
export function withdrawnNoticeOf(distributorName: string): string {
  return `Ya no tienes acceso a ${distributorName}: te desactivaron en su personal. Si crees que es un error, habla con su titular.`;
}
