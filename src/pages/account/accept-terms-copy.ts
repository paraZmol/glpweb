import { pendingLegalTexts } from '@/domain/legal/versions';
import { EmailNotVerifiedError } from '@/domain/tenancy/errors';
import type { UserProfile } from '@/domain/tenancy/types';
import { type ProfileErrors, profileErrorsOf } from '@/features/auth/auth-forms';

// Plain-language reminders taken from docs/legal/terminos.md (§1, §4 and §5). They do not
// replace the document: the boxes link to the full texts.
export const KEY_POINTS = [
  'Hornilla conecta: cada pedido es un acuerdo directo entre tú y la distribuidora que eliges.',
  'Los precios y las promociones los publica cada distribuidora y son su responsabilidad.',
  'Pagas directamente a la distribuidora al recibir. Hornilla no cobra tus pedidos ni guarda tu dinero.',
  'Si una distribuidora no cumple un precio o una promoción, el reclamo se le hace a ella; Hornilla no responde por esa oferta. Esto no te quita los derechos que la ley te da como consumidor.',
];

const COPY = {
  /** A first sign-in: the account exists, its profile does not. */
  first: {
    title: 'Un paso antes de',
    highlighted: 'empezar.',
    lead: 'Ya ingresaste con Google. Para crear tu perfil, confirma tus datos y acepta los términos y la política de privacidad de Hornilla.',
  },
  /** The account accepted an older version of the terms (and maybe of the privacy policy). */
  renewal: {
    title: 'Actualizamos',
    highlighted: 'los términos.',
    lead: 'Para seguir usando Hornilla necesitamos que revises y aceptes las versiones vigentes.',
  },
  /** Only the privacy policy is pending: an account from before the second box, or a new version. */
  privacyOnly: {
    title: 'Actualizamos la política de',
    highlighted: 'privacidad.',
    lead: 'Para seguir usando Hornilla necesitamos que la revises y autorices el uso de tus datos.',
  },
};

export function copyFor(profile: UserProfile | null) {
  if (profile === null) return COPY.first;
  const pending = pendingLegalTexts(profile);
  return pending.privacy && !pending.terms ? COPY.privacyOnly : COPY.renewal;
}

const NOT_VERIFIED =
  'No pudimos confirmar tu correo con Google. Cierra sesión e inténtalo de nuevo.';

/** Where the message of a failed acceptance belongs: next to the name or the phone, or on the form. */
export function acceptanceErrorsOf(error: unknown): ProfileErrors {
  if (error instanceof EmailNotVerifiedError) return { form: NOT_VERIFIED };
  return profileErrorsOf(error);
}
