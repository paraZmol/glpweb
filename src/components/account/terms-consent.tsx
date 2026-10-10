import { CheckboxField } from '@/components/common/checkbox-field';
import { TextLink } from '@/components/common/text-link';
import { ROUTES } from '@/lib/routes';

type TermsConsentProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
};

/**
 * The one box that records the acceptance of the terms (PLAN 2.7). It starts unticked on every
 * screen that uses it, and its links open in another tab so nothing typed is lost. The text is
 * reviewed by `legal-compliance`: change it together with docs/legal.
 */
export function TermsConsent({ checked, onChange, error }: TermsConsentProps) {
  return (
    <CheckboxField
      name="acceptTerms"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      error={error}
    >
      Acepto los{' '}
      <TextLink to={ROUTES.terms} newTab>
        Términos y condiciones
      </TextLink>{' '}
      y la{' '}
      <TextLink to={ROUTES.privacy} newTab>
        Política de privacidad
      </TextLink>
      , y declaro que soy mayor de 18 años.
    </CheckboxField>
  );
}
