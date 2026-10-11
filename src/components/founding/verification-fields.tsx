import { LockKeyhole } from 'lucide-react';
import { TextField } from '@/components/common/text-field';
import {
  HYDROCARBONS_REGISTRY_MAX_LENGTH,
  LEGAL_NAME_MAX_LENGTH,
} from '@/domain/tenancy/constants';
import type { BusinessVerificationInput } from '@/domain/tenancy/verification-input';
import { ICON_STROKE } from '@/lib/icons';

/** Eleven digits, with room for the spaces or hyphens people type between them. */
const TAX_ID_INPUT_MAX_LENGTH = 14;

export const VERIFICATION_NOTE =
  'Estos tres datos no se publican. Hornilla los usa para revisar tu distribuidora antes de mostrarla.';

type VerificationFieldsProps = {
  values: BusinessVerificationInput;
  errors: Partial<Record<keyof BusinessVerificationInput, string>>;
  onChange: (field: keyof BusinessVerificationInput, value: string) => void;
};

/**
 * The three private data the platform reviews before listing a distributor (PLAN 2.11): RUC,
 * registered name and record number of the Registro de Hidrocarburos. Used by the sign-up
 * wizard and by the owner when a platform admin asks for a correction. They are set apart from
 * the public fields and say, next to them, that they are never published.
 */
export function VerificationFields({ values, errors, onChange }: VerificationFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-5 rounded-xl border-[1.5px] border-border p-4 lg:p-5">
      <legend className="sr-only">Datos para la revisión de Hornilla</legend>
      <p className="flex items-start gap-2.5 text-[0.9375rem] font-semibold">
        <LockKeyhole
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-flame-text"
          strokeWidth={ICON_STROKE}
        />
        {VERIFICATION_NOTE}
      </p>
      <TextField
        label="RUC"
        name="taxId"
        inputMode="numeric"
        autoComplete="off"
        maxLength={TAX_ID_INPUT_MAX_LENGTH}
        value={values.taxId}
        onChange={(event) => onChange('taxId', event.target.value)}
        error={errors.taxId}
        hint="11 dígitos, el de la persona o empresa que vende el gas."
      />
      <TextField
        label="Razón social o nombre del titular"
        name="legalName"
        autoComplete="off"
        maxLength={LEGAL_NAME_MAX_LENGTH}
        value={values.legalName}
        onChange={(event) => onChange('legalName', event.target.value)}
        error={errors.legalName}
        hint="Tal como figura en el RUC."
      />
      <TextField
        label="Número de ficha del Registro de Hidrocarburos"
        name="hydrocarbonsRegistry"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={HYDROCARBONS_REGISTRY_MAX_LENGTH}
        value={values.hydrocarbonsRegistry}
        onChange={(event) => onChange('hydrocarbonsRegistry', event.target.value)}
        error={errors.hydrocarbonsRegistry}
        hint="Es el registro de Osinergmin del local de venta o del distribuidor en cilindros. Escríbelo como aparece en tu ficha."
      />
    </fieldset>
  );
}
