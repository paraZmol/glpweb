import { CheckboxField } from '@/components/common/checkbox-field';
import { TextLink } from '@/components/common/text-link';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/domain/legal/versions';
import type { ConsentErrors } from '@/features/auth/auth-forms';
import { ROUTES } from '@/lib/routes';

export type ConsentField = 'acceptTerms' | 'acceptPrivacy';

type LegalConsentsProps = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  onChange: (field: ConsentField, checked: boolean) => void;
  errors: ConsentErrors;
};

/**
 * The two boxes that record the acceptance of an account (PLAN 2.9): terms and age, and privacy
 * policy with the use of data. Both start unticked on every screen and both are required. Their
 * links open in another tab so nothing typed is lost. The texts are reviewed by
 * `legal-compliance`: change them together with docs/legal.
 */
export function LegalConsents({
  acceptTerms,
  acceptPrivacy,
  onChange,
  errors,
}: LegalConsentsProps) {
  return (
    <div className="flex flex-col gap-4">
      <CheckboxField
        name="acceptTerms"
        checked={acceptTerms}
        onChange={(event) => onChange('acceptTerms', event.target.checked)}
        error={errors.acceptTerms}
      >
        Acepto los{' '}
        <TextLink to={ROUTES.terms} newTab>
          Términos y condiciones
        </TextLink>{' '}
        de Hornilla y declaro que tengo 18 años o más.
      </CheckboxField>
      <CheckboxField
        name="acceptPrivacy"
        checked={acceptPrivacy}
        onChange={(event) => onChange('acceptPrivacy', event.target.checked)}
        error={errors.acceptPrivacy}
      >
        Leí la{' '}
        <TextLink to={ROUTES.privacy} newTab>
          Política de privacidad
        </TextLink>{' '}
        y autorizo a Hornilla a usar mis datos (nombre, correo, celular y, cuando pida, mis
        direcciones) para crear mi cuenta y gestionar mis pedidos con la distribuidora que elija. Sé
        que se guardan en servidores de Google fuera del Perú.
      </CheckboxField>
    </div>
  );
}

/** Which text is being accepted: shown next to the boxes, and kept with each acceptance. */
export function LegalVersionNote({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-sm text-muted-foreground tabular-nums'}>
      Términos versión {TERMS_VERSION} y Política de privacidad versión {PRIVACY_VERSION},
      preliminares y en revisión.
    </p>
  );
}
