import { TextField } from '@/components/common/text-field';
import { DISTRIBUTOR_NAME_MAX_LENGTH } from '@/domain/tenancy/constants';
import type { FoundingErrors, FoundingForm } from '@/features/tenancy/founding-form';
import type { SetFoundingField } from '@/features/tenancy/use-founding-wizard';
import type { SlugAvailability } from '@/features/tenancy/use-slug-check';
import { SlugField } from './slug-field';
import { VerificationFields } from './verification-fields';

export type StepProps = {
  form: FoundingForm;
  errors: FoundingErrors;
  set: SetFoundingField;
};

const PHONE_FIELD = { type: 'tel', inputMode: 'numeric', autoComplete: 'off' } as const;

/**
 * Step 1 (PLAN 2.2, 2.11): how the business is called, its link, how customers reach it and
 * the three private data Hornilla reviews before listing it.
 */
export function StepBusiness({
  form,
  errors,
  set,
  slugAvailability,
}: StepProps & { slugAvailability: SlugAvailability }) {
  return (
    <>
      <TextField
        label="Nombre de la distribuidora"
        name="name"
        autoComplete="organization"
        maxLength={DISTRIBUTOR_NAME_MAX_LENGTH}
        value={form.name}
        onChange={(event) => set('name', event.target.value)}
        error={errors.name}
        hint="Como la conocen tus clientes."
      />
      <SlugField
        value={form.slug}
        onChange={(value) => set('slug', value)}
        error={errors.slug}
        availability={slugAvailability}
      />
      <TextField
        {...PHONE_FIELD}
        label="Teléfono del negocio"
        name="contactPhone"
        value={form.contactPhone}
        onChange={(event) => set('contactPhone', event.target.value)}
        error={errors.contactPhone}
        hint="Celular de 9 dígitos. Es público: aquí te llaman para pedir."
      />
      <TextField
        {...PHONE_FIELD}
        label="WhatsApp del negocio (opcional)"
        name="whatsapp"
        value={form.whatsapp}
        onChange={(event) => set('whatsapp', event.target.value)}
        error={errors.whatsapp}
        hint="Si lo dejas vacío, usamos el teléfono del negocio."
      />
      <TextField
        {...PHONE_FIELD}
        label="Tu celular"
        name="ownerPhone"
        autoComplete="tel-national"
        value={form.ownerPhone}
        onChange={(event) => set('ownerPhone', event.target.value)}
        error={errors.ownerPhone}
        hint="Para que Hornilla te contacte por el servicio. No es público."
      />
      <VerificationFields
        values={form}
        errors={errors}
        onChange={(field, value) => set(field, value)}
      />
    </>
  );
}
