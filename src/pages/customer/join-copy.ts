import {
  AlreadyMemberError,
  InviteExpiredError,
  InviteForAnotherAccountError,
  InviteNotFoundError,
  InviteRevokedError,
  InviteUsedError,
} from '@/domain/staff/errors';
import { INVITE_TTL_DAYS } from '@/domain/staff/constants';

/** The broken link: the fragment is missing or is not an invitation. */
export const BROKEN_LINK = {
  title: 'Este enlace de invitación no está completo.',
  description:
    'Le falta una parte. Pide a quien te invitó que te lo envíe de nuevo y ábrelo entero, sin cortarlo.',
};

const ASK_AGAIN = 'Pide una invitación nueva a quien te la envió.';

/**
 * An invitation this account cannot read: tied to another address, or missing. What to do in
 * either case; the screen puts the address of the session first ("Estás con …").
 */
export const NOT_FOR_THIS_ACCOUNT = {
  title: 'Esta invitación no es para esta cuenta.',
  description:
    'Si te invitaron con otro correo, ingresa con esa cuenta. Si no, pide que te envíen la invitación otra vez.',
};

export interface JoinStopCopy {
  title: string;
  description: string;
}

/**
 * What `/unirme` says when the invitation cannot be used (PLAN 3.2): the headline and what to
 * do about it, without repeating one in the other. Null for a refusal that is not about the
 * invitation itself (connection, a read-only distributor): the card says that one.
 */
export function joinStopCopyOf(refusal: Error, distributorName: string): JoinStopCopy | null {
  // An invitation tied to another address cannot even be read (PLAN §11, 2026-10-16): the
  // screen cannot tell it from one that does not exist: one message serves both cases and
  // asserts neither.
  if (refusal instanceof InviteNotFoundError || refusal instanceof InviteForAnotherAccountError) {
    return NOT_FOR_THIS_ACCOUNT;
  }
  if (refusal instanceof InviteExpiredError) {
    return {
      title: 'Esta invitación venció.',
      description: `Cada invitación dura ${INVITE_TTL_DAYS} días. ${ASK_AGAIN}`,
    };
  }
  if (refusal instanceof InviteUsedError) {
    return { title: 'Esta invitación ya se usó.', description: `Sirve una sola vez. ${ASK_AGAIN}` };
  }
  if (refusal instanceof InviteRevokedError) {
    return { title: 'Esta invitación fue anulada.', description: `Ya no sirve. ${ASK_AGAIN}` };
  }
  if (refusal instanceof AlreadyMemberError) {
    return refusal.isActive
      ? {
          title: `Ya formas parte de ${distributorName}.`,
          description: 'Entra a su panel desde aquí.',
        }
      : {
          title: `Ya no tienes acceso a ${distributorName}.`,
          description: 'Una invitación no te vuelve a activar: pídeselo a su titular.',
        };
  }
  return null;
}

/** The refusal is about the invitation or the membership: it takes the whole screen. */
export function isInvitationRefusal(refusal: Error): boolean {
  return joinStopCopyOf(refusal, '') !== null;
}
