import { type FormEvent, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { Button, ButtonLink } from '@/components/common/button';
import { touchesIdentity } from '@/domain/tenancy/listing';
import type { Distributor } from '@/domain/tenancy/types';
import {
  hasChanges,
  type ProfileEditErrors,
  type ProfileEditForm,
  profileEditErrorsOf,
  profileEditFormOf,
  profilePatchOf,
  validateProfileEdit,
} from '@/features/tenancy/profile-edit';
import { editDistributorProfile } from '@/features/tenancy/tenancy-actions';
import { ROUTES } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';
import { ProfileFields, type SetProfileField } from './profile-fields';

const OFFLINE_TEXT = 'Sin conexión: para guardar los cambios necesitas internet.';
// PLAN 2.11: said BEFORE saving, as soon as the name, a phone or the address differs from what
// is stored (`IDENTITY_FIELDS`).
export const BACK_TO_REVIEW =
  'Cambiar el nombre, el teléfono, el WhatsApp o la dirección devuelve tu ficha a revisión: dejará de verse en el buscador y en tu enlace hasta que Hornilla la apruebe de nuevo.';
const STILL_IN_REVIEW = 'Tu ficha todavía está en revisión: Hornilla verá los datos nuevos.';
const NOTHING_CHANGED = 'No cambiaste nada todavía.';

type ProfileEditFormProps = {
  distributor: Distributor;
  /** The form as typed so far, so the live sample beside it can follow. */
  onPreview: (form: ProfileEditForm) => void;
  onSaved: (isBackInReview: boolean) => void;
};

/**
 * Owner edit of the public profile (PLAN 2.11). Only what changed is sent. An edit of the name
 * or of a phone on an approved listing asks once more before saving, saying what it costs.
 */
export function ProfileEditFormPanel({ distributor, onPreview, onSaved }: ProfileEditFormProps) {
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(() => profileEditFormOf(distributor));
  const [errors, setErrors] = useState<ProfileEditErrors>({});
  const [isConfirming, setConfirming] = useState(false);
  useFocusFirstInvalid(formRef, errors);

  const patch = profilePatchOf(form, distributor);
  const changesIdentity = touchesIdentity(patch);
  const leavesTheSearch = changesIdentity && distributor.listingApproved;
  const identityNotice = changesIdentity
    ? distributor.listingApproved
      ? BACK_TO_REVIEW
      : STILL_IN_REVIEW
    : null;

  const set: SetProfileField = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    onPreview(next);
    setConfirming(false);
    const refused = field === 'days' || field === 'opensAt' || field === 'closesAt';
    setErrors(({ [refused ? 'schedule' : field]: _edited, form: _whole, ...rest }) => rest);
  };

  const save = () =>
    void run(async () => {
      try {
        const outcome = await editDistributorProfile(distributor.id, patch);
        onSaved(outcome.isBackInReview);
      } catch (error) {
        setConfirming(false);
        setErrors(profileEditErrorsOf(error));
      }
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!hasChanges(patch)) return setErrors({ form: NOTHING_CHANGED });
    const problems = validateProfileEdit(patch);
    setErrors(problems);
    if (Object.keys(problems).length > 0 || !isOnline) return undefined;
    if (leavesTheSearch && !isConfirming) return setConfirming(true);
    return save();
  };

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-8">
      <ProfileFields form={form} errors={errors} set={set} identityNotice={identityNotice} />
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      {isConfirming ? (
        <div role="group" aria-labelledby="confirmar-revision" className="rounded-lg bg-muted p-4">
          <p id="confirmar-revision" className="font-heading text-lg font-bold">
            ¿Guardar y volver a revisión?
          </p>
          <p className="mt-1 text-muted-foreground">{BACK_TO_REVIEW}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="ink"
              loading={isRunning}
              loadingLabel="Guardando los cambios…"
            >
              Guardar y enviar a revisión
            </Button>
            <Button
              type="button"
              variant="line"
              disabled={isRunning}
              onClick={() => setConfirming(false)}
            >
              Seguir editando
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            loading={isRunning}
            loadingLabel="Guardando los cambios…"
            disabled={!isOnline}
          >
            Guardar cambios
          </Button>
          <ButtonLink to={ROUTES.officeHome} variant="line">
            Cancelar
          </ButtonLink>
        </div>
      )}
    </form>
  );
}
