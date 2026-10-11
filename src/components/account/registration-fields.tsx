import { PasswordField } from '@/components/common/password-field';
import { TextField } from '@/components/common/text-field';
import { MIN_PASSWORD_LENGTH } from '@/domain/auth/session';
import { DISPLAY_NAME_MAX_LENGTH } from '@/domain/tenancy/constants';
import type { RegistrationErrors, RegistrationForm } from '@/features/auth/auth-forms';
import { TextLink } from '@/components/common/text-link';
import { ROUTES } from '@/lib/routes';

export type SetRegistrationField = <Field extends keyof RegistrationForm>(
  field: Field,
  value: RegistrationForm[Field],
) => void;

type RegistrationFieldsProps = {
  form: RegistrationForm;
  errors: RegistrationErrors;
  set: SetRegistrationField;
};

/**
 * The fields of the registration form (PLAN 2.1). It asks for no consent (PLAN 2.11): nothing is
 * stored until the e-mail is verified, so the terms and the privacy policy are accepted on the
 * step after that, and the form says so.
 */
export function RegistrationFields({ form, errors, set }: RegistrationFieldsProps) {
  return (
    <>
      <TextField
        label="Nombre"
        name="displayName"
        autoComplete="name"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        value={form.displayName}
        onChange={(event) => set('displayName', event.target.value)}
        error={errors.displayName}
      />
      <TextField
        label="Correo"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={form.email}
        onChange={(event) => set('email', event.target.value)}
        error={errors.email}
        hint="Te enviaremos un enlace para verificarlo."
      />
      <PasswordField
        label="Contraseña"
        name="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(event) => set('password', event.target.value)}
        error={errors.password}
        hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
      />
      <TextField
        label="Celular (opcional)"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={form.phone}
        onChange={(event) => set('phone', event.target.value)}
        error={errors.phone}
        hint="9 dígitos. Lo ve la distribuidora a la que le pidas, para coordinar la entrega."
      />
      <p className="text-[0.9375rem] text-muted-foreground">
        Los{' '}
        <TextLink to={ROUTES.terms} newTab>
          Términos y condiciones
        </TextLink>{' '}
        y la{' '}
        <TextLink to={ROUTES.privacy} newTab>
          Política de privacidad
        </TextLink>{' '}
        se aceptan en el paso siguiente, después de verificar tu correo. Al crear la cuenta
        guardamos solo tu correo y tu contraseña cifrada; tu nombre y tu celular esperan en esta
        pestaña hasta que aceptes.
      </p>
    </>
  );
}
