import {
  AccountInUseError,
  AddressLimitError,
  DistributorLimitError,
  EmailNotVerifiedError,
  FoundingBlockedError,
  InvalidInputError,
  OfflineError,
  PermissionDeniedError,
  ProfileRequiredError,
  SlugTakenError,
} from '../../domain/tenancy/errors';
import type { FieldIssue } from '../../domain/tenancy/field-checks';
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from '../../domain/tenancy/slug';

const ISSUE_MESSAGES: Record<FieldIssue['code'], string> = {
  required: 'Completa este dato.',
  tooShort: 'Es demasiado corto.',
  tooLong: 'Es demasiado largo.',
  outOfRange: 'Está fuera del rango permitido.',
  invalid: 'Revisa este dato.',
  tooFaint: 'Ese color casi no se distingue del fondo. Prueba con un tono más intenso.',
  invalidCharacters: 'Usa solo letras minúsculas, números y guiones.',
  reserved: 'Ese enlace está reservado. Prueba con otro.',
};

const FIELD_MESSAGES: Record<string, string> = {
  'slug:tooShort': `El enlace necesita al menos ${SLUG_MIN_LENGTH} caracteres.`,
  'slug:tooLong': `El enlace admite hasta ${SLUG_MAX_LENGTH} caracteres.`,
  'contactPhone:invalid': 'Escribe un celular de 9 dígitos que empiece en 9.',
  'whatsapp:invalid': 'Escribe un celular de 9 dígitos que empiece en 9.',
  'ownerPhone:invalid': 'Escribe un celular de 9 dígitos que empiece en 9.',
  'phone:invalid': 'Escribe un celular de 9 dígitos que empiece en 9.',
  'taxId:required': 'Escribe el RUC del negocio.',
  'taxId:invalid': 'Revisa el RUC: son 11 dígitos y alguno no coincide.',
  'legalName:required': 'Escribe la razón social o el nombre del titular, como figura en el RUC.',
  'hydrocarbonsRegistry:required': 'Escribe el número de registro de Osinergmin.',
  'hydrocarbonsRegistry:invalid':
    'Escribe el número de registro tal como figura: solo letras, números, guiones, puntos o barras.',
  'reviewNote:tooLong': 'La nota es demasiado larga.',
  'plant:invalid': 'Marca la ubicación de la planta en el mapa.',
  'location:invalid': 'Marca la ubicación en el mapa.',
  'brandColor:invalid': 'Elige un color válido.',
  'acceptTerms:required': 'Debes aceptar los términos para continuar.',
  'acceptPrivacy:required': 'Debes aceptar la política de privacidad para continuar.',
  'declaresAuthority:required':
    'Confirma que puedes representar al negocio y que cuenta con las autorizaciones para vender gas.',
};

/** Message in Spanish for one rejected form field. */
export function describeFieldIssue(issue: FieldIssue): string {
  return FIELD_MESSAGES[`${issue.field}:${issue.code}`] ?? ISSUE_MESSAGES[issue.code];
}

/** Field name → message, to paint a form after an `InvalidInputError`. */
export function fieldMessagesOf(error: unknown): Record<string, string> {
  if (!(error instanceof InvalidInputError)) return {};
  return Object.fromEntries(error.issues.map((issue) => [issue.field, describeFieldIssue(issue)]));
}

/** Message in Spanish for anything an account or distributor action can throw. */
export function describeTenancyError(error: unknown): string {
  if (error instanceof SlugTakenError) return 'Ese enlace ya lo usa otra distribuidora.';
  if (error instanceof InvalidInputError) return 'Revisa los datos marcados.';
  if (error instanceof EmailNotVerifiedError) {
    // Said on screens without a way out of the session (the sign-up of a distributor, the
    // review of the platform): it says where that is.
    return 'No pudimos confirmar tu correo con Google. Ve a Cuenta, cierra la sesión y vuelve a ingresar.';
  }
  if (error instanceof DistributorLimitError) {
    return `Una cuenta puede registrar hasta ${error.limit} distribuidoras.`;
  }
  if (error instanceof FoundingBlockedError) {
    return 'Una de tus distribuidoras está en solo lectura. Regularízala antes de registrar otra.';
  }
  if (error instanceof AddressLimitError) {
    return `Puedes guardar hasta ${error.limit} direcciones. Borra una para agregar otra.`;
  }
  if (error instanceof ProfileRequiredError) return 'Completa tu perfil antes de continuar.';
  if (error instanceof AccountInUseError) {
    return 'Tu cuenta ya tiene datos guardados. Para eliminarla, escríbenos desde Contacto.';
  }
  if (error instanceof PermissionDeniedError) {
    return 'No tienes permiso para hacer esto, o la distribuidora está en solo lectura.';
  }
  if (error instanceof OfflineError) return 'No hay conexión. Vuelve a intentar cuando regrese.';
  return 'No pudimos completar la acción. Vuelve a intentar.';
}
