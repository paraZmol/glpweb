import type { ReactNode } from 'react';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextField } from '@/components/common/text-field';
import { BrandColorField } from '@/components/founding/brand-color-field';
import { BrandPreview } from '@/components/founding/brand-preview';
import { RadiusStepper } from '@/components/founding/radius-stepper';
import { ADDRESS_LINE_MAX_LENGTH, DISTRIBUTOR_NAME_MAX_LENGTH } from '@/domain/tenancy/constants';
import {
  type IdentityInput,
  type ProfileEditErrors,
  type ProfileEditForm,
  toggleDay,
} from '@/features/tenancy/profile-edit';
import { ScheduleFields } from './schedule-fields';

const PHONE_FIELD = { type: 'tel', inputMode: 'numeric', autoComplete: 'off' } as const;

export type SetProfileField = <Field extends keyof ProfileEditForm>(
  field: Field,
  value: ProfileEditForm[Field],
) => void;

type ProfileFieldsProps = {
  form: ProfileEditForm;
  errors: ProfileEditErrors;
  set: SetProfileField;
  /** What changing the name, a phone or the address costs; null while none of them differs. */
  identityNotice: string | null;
  /** The field it is said under: the one being edited, so it is read where the eyes are. */
  noticeAt: IdentityInput | null;
  /** Read-only distributor: every field shows what is stored (or was typed) and takes nothing. */
  disabled: boolean;
};

// Native buttons inside a disabled fieldset are off, but only look it if something says so.
const DISABLED_LOOK =
  '[&:disabled_button]:pointer-events-none [&:disabled_button]:opacity-60 [&:disabled_output]:opacity-60';

type GroupProps = { title: string; disabled: boolean; children: ReactNode };

function Group({ title, disabled, children }: GroupProps) {
  return (
    <fieldset disabled={disabled} className={`flex min-w-0 flex-col gap-5 ${DISABLED_LOOK}`}>
      <legend className="mb-4 font-heading text-lg font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * The fields of the public profile an owner may edit (PLAN 2.11), in three subjects: who it is
 * (changing it sends the listing back to review), where and when it delivers, and its colour.
 */
export function ProfileFields(props: ProfileFieldsProps) {
  const { form, errors, set, identityNotice, noticeAt, disabled } = props;
  const noticeUnder = (field: IdentityInput) =>
    identityNotice !== null && noticeAt === field ? (
      <InlineAlert tone="info">{identityNotice}</InlineAlert>
    ) : null;
  return (
    <>
      <Group title="Nombre y contacto" disabled={disabled}>
        <TextField
          label="Nombre de la distribuidora"
          name="name"
          autoComplete="organization"
          maxLength={DISTRIBUTOR_NAME_MAX_LENGTH}
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name}
        />
        {noticeUnder('name')}
        <TextField
          {...PHONE_FIELD}
          label="Teléfono del negocio"
          name="contactPhone"
          value={form.contactPhone}
          onChange={(event) => set('contactPhone', event.target.value)}
          error={errors.contactPhone}
          hint="Celular de 9 dígitos. Es público."
        />
        {noticeUnder('contactPhone')}
        <TextField
          {...PHONE_FIELD}
          label="WhatsApp del negocio"
          name="whatsapp"
          value={form.whatsapp}
          onChange={(event) => set('whatsapp', event.target.value)}
          error={errors.whatsapp}
          hint="Celular de 9 dígitos. Es público."
        />
        {noticeUnder('whatsapp')}
      </Group>
      <Group title="Dónde y cuándo atiendes" disabled={disabled}>
        <TextField
          label="Dirección de la planta"
          name="addressLine"
          autoComplete="off"
          maxLength={ADDRESS_LINE_MAX_LENGTH}
          value={form.addressLine}
          onChange={(event) => set('addressLine', event.target.value)}
          error={errors.addressLine}
          hint="Es pública. La ubicación en el mapa se podrá mover cuando llegue el mapa."
        />
        {noticeUnder('addressLine')}
        <RadiusStepper
          value={form.coverageRadiusKm}
          onChange={(radiusKm) => set('coverageRadiusKm', radiusKm)}
          error={errors.coverageRadiusKm}
        />
        <ScheduleFields
          days={form.days}
          opensAt={form.opensAt}
          closesAt={form.closesAt}
          error={errors.schedule}
          onToggleDay={(day) => set('days', toggleDay(form.days, day))}
          onChangeTime={(field, value) => set(field, value)}
        />
      </Group>
      <Group title="Color" disabled={disabled}>
        <BrandColorField
          color={form.brandColor}
          error={errors.brandColor}
          onChange={(color) => set('brandColor', color)}
        />
        <BrandPreview color={form.brandColor} name={form.name} className="lg:hidden" />
      </Group>
    </>
  );
}
