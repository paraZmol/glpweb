import { type AuthErrorCode, isAuthError } from '../../domain/auth/errors';

const MESSAGES: Record<AuthErrorCode, string> = {
  tooManyAttempts: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  network: 'No hay conexión. Revisa tu internet y vuelve a intentar.',
  cancelled: 'Se canceló el ingreso.',
  accountDisabled: 'Esta cuenta está deshabilitada. Escríbenos si crees que es un error.',
  providerMismatch:
    'Ese correo ya tiene una cuenta que no entra con Google. Escríbenos y lo revisamos.',
  recentLoginRequired: 'Por seguridad, vuelve a ingresar para continuar.',
  notSignedIn: 'Tu sesión terminó. Ingresa de nuevo.',
  unknown: 'No pudimos completar la acción. Vuelve a intentar.',
};

/** Message in Spanish for anything a sign-in action can throw. */
export function describeAuthError(error: unknown): string {
  return MESSAGES[isAuthError(error) ? error.code : 'unknown'];
}
