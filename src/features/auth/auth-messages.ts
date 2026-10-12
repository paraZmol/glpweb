import { type AuthErrorCode, isAuthError } from '../../domain/auth/errors';
import { MIN_PASSWORD_LENGTH } from '../../domain/auth/session';

const MESSAGES: Record<AuthErrorCode, string> = {
  emailAlreadyInUse: 'Ya existe una cuenta con ese correo. Prueba ingresar.',
  invalidCredentials: 'El correo o la contraseña no coinciden.',
  invalidEmail: 'Escribe un correo válido.',
  weakPassword: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  tooManyAttempts: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  network: 'No hay conexión. Revisa tu internet y vuelve a intentar.',
  cancelled: 'Se canceló el ingreso.',
  accountDisabled: 'Esta cuenta está deshabilitada. Escríbenos si crees que es un error.',
  providerMismatch: 'Ese correo ya está registrado con otro método de ingreso.',
  recentLoginRequired: 'Por seguridad, vuelve a ingresar para continuar.',
  notSignedIn: 'Tu sesión terminó. Ingresa de nuevo.',
  unknown: 'No pudimos completar la acción. Vuelve a intentar.',
};

/** Message in Spanish for anything a sign-in action can throw. */
export function describeAuthError(error: unknown): string {
  return MESSAGES[isAuthError(error) ? error.code : 'unknown'];
}
