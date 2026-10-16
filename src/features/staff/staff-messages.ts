import { HELPER_NAME_MAX_LENGTH, INVITE_TTL_DAYS } from '../../domain/staff/constants';
import {
  AlreadyMemberError,
  HelperLimitError,
  HelperNotFoundError,
  InviteExpiredError,
  InviteForAnotherAccountError,
  InviteNotFoundError,
  InviteRevokedError,
  InviteUsedError,
  MemberChangeNotAllowedError,
  type MemberChangeRefusal,
  MemberNotFoundError,
  UnreadableNameError,
} from '../../domain/staff/errors';
import type { InviteState } from '../../domain/staff/invite';
import {
  InvalidInputError,
  NothingChangedError,
  PermissionDeniedError,
} from '../../domain/tenancy/errors';
import type { FieldIssue } from '../../domain/tenancy/field-checks';
import type { MemberRole } from '../../domain/tenancy/types';
import { describeFieldIssue, describeTenancyError } from '../tenancy/tenancy-messages';

// Roles as the screens name them (PLAN §11, 2026-10-10: "Titular", "Central", "Reparto").
const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Titular',
  dispatcher: 'Central',
  driver: 'Reparto',
};

export function roleLabelOf(role: MemberRole): string {
  return ROLE_LABELS[role];
}

const STAFF_FIELD_MESSAGES: Record<string, string> = {
  'role:founderOnly': 'Solo quien registró la distribuidora puede invitar a otro titular.',
  'role:invalid': 'Elige un rol.',
  'email:required': 'Para invitar a un titular escribe su correo de Google.',
  'email:invalid': 'Revisa el correo: debe tener una @ y un dominio, sin espacios.',
  'email:tooLong': 'El correo es demasiado largo.',
  'name:required': 'Escribe el nombre.',
  'name:tooLong': `El nombre admite hasta ${HELPER_NAME_MAX_LENGTH} caracteres.`,
  'name:invalid': 'Escribe el nombre con letras o números, sin caracteres invisibles.',
};

/** Message in Spanish for one rejected field of an invitation or of a helper. */
export function describeStaffIssue(issue: FieldIssue): string {
  return STAFF_FIELD_MESSAGES[`${issue.field}:${issue.code}`] ?? describeFieldIssue(issue);
}

/** Field name → message, to paint the invitation or helper form after `InvalidInputError`. */
export function staffFieldMessagesOf(error: unknown): Record<string, string> {
  if (!(error instanceof InvalidInputError)) return {};
  return Object.fromEntries(error.issues.map((issue) => [issue.field, describeStaffIssue(issue)]));
}

const INVITE_STATE_LABELS: Record<InviteState, string> = {
  usable: 'Esperando',
  expired: 'Venció',
  accepted: 'Usada',
  revoked: 'Anulada',
};

export function inviteStateLabelOf(state: InviteState): string {
  return INVITE_STATE_LABELS[state];
}

const ASK_AGAIN = 'Pide una invitación nueva a quien te la envió.';

/** Message in Spanish for what using an invitation can throw. */
export function describeJoinError(error: unknown): string {
  if (error instanceof InviteNotFoundError) {
    return `No encontramos esta invitación. Revisa que el enlace esté completo o ${ASK_AGAIN.toLowerCase()}`;
  }
  if (error instanceof InviteExpiredError) {
    return `Esta invitación venció: dura ${INVITE_TTL_DAYS} días. ${ASK_AGAIN}`;
  }
  if (error instanceof InviteUsedError) return `Esta invitación ya se usó. ${ASK_AGAIN}`;
  if (error instanceof InviteRevokedError) return `Esta invitación fue anulada. ${ASK_AGAIN}`;
  if (error instanceof InviteForAnotherAccountError) {
    return 'Esta invitación es para otra cuenta de Google. Ingresa con la cuenta a la que te invitaron.';
  }
  if (error instanceof AlreadyMemberError) {
    return error.isActive
      ? 'Ya formas parte de esta distribuidora.'
      : 'Ya formaste parte de esta distribuidora. Pide a su titular que te vuelva a activar.';
  }
  if (error instanceof UnreadableNameError) {
    return 'Tu nombre en Hornilla no se puede leer. Cámbialo en Tu cuenta y vuelve a abrir el enlace.';
  }
  if (error instanceof PermissionDeniedError) {
    return `No pudimos usar la invitación: la distribuidora no puede sumar personal ahora o la invitación cambió. ${ASK_AGAIN}`;
  }
  return describeTenancyError(error);
}

const CHANGE_REFUSALS: Record<MemberChangeRefusal, string> = {
  self: 'No puedes cambiar tu propio rol ni desactivarte.',
  founder: 'Quien registró la distribuidora siempre sigue como titular.',
  ownersByFounderOnly: 'Solo quien registró la distribuidora puede cambiar a otro titular.',
};

/** Message in Spanish for anything a staff action of the owner can throw. */
export function describeStaffError(error: unknown): string {
  if (error instanceof MemberChangeNotAllowedError) return CHANGE_REFUSALS[error.reason];
  if (error instanceof MemberNotFoundError) {
    return 'Esa persona ya no está en tu personal. Vuelve a cargar la lista.';
  }
  if (error instanceof HelperLimitError) {
    return `Puedes tener hasta ${error.limit} ayudantes, también los desactivados.`;
  }
  if (error instanceof HelperNotFoundError) {
    return 'Ese ayudante ya no está en tu lista. Vuelve a cargarla.';
  }
  if (error instanceof InviteUsedError) {
    return 'Esa invitación ya se usó: desactiva a la persona si ya no debe entrar.';
  }
  if (error instanceof InviteRevokedError) return 'Esa invitación ya estaba anulada.';
  if (error instanceof InviteNotFoundError) return 'Esa invitación ya no existe.';
  if (error instanceof NothingChangedError) return 'No cambiaste nada.';
  return describeTenancyError(error);
}
