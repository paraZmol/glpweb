import { LockKeyhole } from 'lucide-react';
import { OutsideLink } from '@/components/common/outside-link';
import { TextField } from '@/components/common/text-field';
import { TextLink } from '@/components/common/text-link';
import {
  HYDROCARBONS_REGISTRY_MAX_LENGTH,
  LEGAL_NAME_MAX_LENGTH,
} from '@/domain/tenancy/constants';
import type { BusinessVerificationInput } from '@/domain/tenancy/verification-input';
import { ICON_STROKE } from '@/lib/icons';
import { OFFICIAL_SOURCES } from '@/lib/official-sources';
import { ROUTES } from '@/lib/routes';

/** Eleven digits, with room for the spaces or hyphens people type between them. */
const TAX_ID_INPUT_MAX_LENGTH = 14;

// Reviewed by `legal-compliance` (PLAN 2.11): change them together with docs/legal. The second
// sentence ends with the link to the privacy policy, so its full stop is not in the constant.
const PRIVATE_DATA_TITLE = 'Estos tres datos no se publican.';
const PRIVATE_DATA_DETAIL =
  'Hornilla los usa para revisar tu distribuidora antes de mostrarla; solo los ven tú y la administración de Hornilla. El detalle está en la';
// It never says the answers are kept: the draft of the sign-up lives in memory only.
const REGISTRY_HELP =
  'Está en el documento de inscripción de tu local, que da Osinergmin. Si no lo tienes a mano, búscalo con tu RUC en el enlace de abajo.';

type VerificationFieldsProps = {
  values: BusinessVerificationInput;
  errors: Partial<Record<keyof BusinessVerificationInput, string>>;
  onChange: (field: keyof BusinessVerificationInput, value: string) => void;
  /** Read-only distributor: the three fields show their values and take nothing. */
  disabled?: boolean;
};

/**
 * The three private data the platform reviews before listing a distributor (PLAN 2.11): RUC,
 * registered name and record number in Osinergmin's Registro de Hidrocarburos. Used by the sign-up
 * wizard and by the owner when a platform admin asks for a correction. They are set apart from
 * the public fields and say, next to them, that they are never published.
 */
export function VerificationFields(props: VerificationFieldsProps) {
  const { values, errors, onChange, disabled = false } = props;
  return (
    <fieldset
      disabled={disabled}
      className="flex min-w-0 flex-col gap-5 rounded-xl border-[1.5px] border-border p-4 lg:p-5"
    >
      <legend className="sr-only">Datos para la revisión de Hornilla</legend>
      <p className="flex items-start gap-2.5 text-[0.9375rem]">
        <LockKeyhole
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-flame-text"
          strokeWidth={ICON_STROKE}
        />
        <span>
          <strong className="block font-semibold">{PRIVATE_DATA_TITLE}</strong>{' '}
          <span className="text-muted-foreground">
            {PRIVATE_DATA_DETAIL}{' '}
            <TextLink to={ROUTES.privacy} newTab>
              Política de privacidad
            </TextLink>
            .
          </span>
        </span>
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
        hint="El de quien vende el gas: tu empresa o tú, si trabajas con RUC de persona."
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
        label="Número de registro de Osinergmin (Hidrocarburos)"
        name="hydrocarbonsRegistry"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={HYDROCARBONS_REGISTRY_MAX_LENGTH}
        value={values.hydrocarbonsRegistry}
        onChange={(event) => onChange('hydrocarbonsRegistry', event.target.value)}
        error={errors.hydrocarbonsRegistry}
        hint={
          <>
            {REGISTRY_HELP}
            <span className="mt-1.5 block">
              <OutsideLink href={OFFICIAL_SOURCES.hydrocarbonsRegistry}>
                Consulta del Registro de Hidrocarburos
              </OutsideLink>
            </span>
          </>
        }
      />
    </fieldset>
  );
}
