import { TextField } from '@/components/common/text-field';
import { DISPLAY_NAME_MAX_LENGTH } from '@/domain/tenancy/constants';
import type { ProfileErrors } from '@/features/auth/auth-forms';

export type ProfileDetails = { displayName: string; phone: string };

type ProfileDetailsFieldsProps = {
  details: ProfileDetails;
  errors: ProfileErrors;
  onChange: (field: keyof ProfileDetails, value: string) => void;
};

/**
 * Name and phone of a new account, shown on the terms step so the person confirms or corrects
 * what it typed when registering (or what Google gave) before the profile exists (PLAN 2.11).
 */
export function ProfileDetailsFields({ details, errors, onChange }: ProfileDetailsFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="mb-4 font-heading text-xl font-bold">Confirma tus datos</legend>
      <TextField
        label="Nombre"
        name="displayName"
        autoComplete="name"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        value={details.displayName}
        onChange={(event) => onChange('displayName', event.target.value)}
        error={errors.displayName}
      />
      <TextField
        label="Celular (opcional)"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={details.phone}
        onChange={(event) => onChange('phone', event.target.value)}
        error={errors.phone}
        hint="9 dígitos. Lo ve la distribuidora a la que le pidas, para coordinar la entrega."
      />
    </fieldset>
  );
}
