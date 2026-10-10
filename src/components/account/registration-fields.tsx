import { PasswordField } from '@/components/common/password-field';
import { TextField } from '@/components/common/text-field';
import { MIN_PASSWORD_LENGTH } from '@/domain/auth/session';
import { DISPLAY_NAME_MAX_LENGTH } from '@/domain/tenancy/constants';
import type { RegistrationErrors, RegistrationForm } from '@/features/auth/auth-forms';
import { TermsConsent } from './terms-consent';

export type SetRegistrationField = <Field extends keyof RegistrationForm>(
  field: Field,
  value: RegistrationForm[Field],
) => void;

type RegistrationFieldsProps = {
  form: RegistrationForm;
  errors: RegistrationErrors;
  set: SetRegistrationField;
};

/** The fields of the registration form (PLAN 2.1) and the box of the terms (PLAN 2.7). */
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
      <TermsConsent
        checked={form.acceptTerms}
        onChange={(checked) => set('acceptTerms', checked)}
        error={errors.acceptTerms}
      />
    </>
  );
}
