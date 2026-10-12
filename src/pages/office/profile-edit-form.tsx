import { type FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FormStatus } from '@/components/account/form-parts';
import type { Distributor } from '@/domain/tenancy/types';
import {
  hasChanges,
  type IdentityInput,
  identityNoticeFieldOf,
  isIdentityInput,
  type ProfileEditErrors,
  type ProfileEditForm,
  profileEditErrorsOf,
  profileEditFormOf,
  profilePatchOf,
  validateProfileEdit,
} from '@/features/tenancy/profile-edit';
import { editDistributorProfile } from '@/features/tenancy/tenancy-actions';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';
import { ProfileEditActions } from './profile-edit-actions';
import { ProfileFields, type SetProfileField } from './profile-fields';

const OFFLINE_TEXT = 'Sin conexión: para guardar los cambios necesitas internet.';
// PLAN 2.11: said BEFORE saving, as soon as the name, a phone or the address differs from what
// is stored (`IDENTITY_FIELDS`).
export const BACK_TO_REVIEW =
  'Cambiar el nombre, el teléfono, el WhatsApp o la dirección devuelve tu ficha a revisión: dejará de verse en el buscador y en tu enlace hasta que Hornilla la apruebe de nuevo.';
const STILL_IN_REVIEW = 'Tu ficha todavía está en revisión: Hornilla verá los datos nuevos.';
const NOTHING_CHANGED = 'No cambiaste nada todavía.';
const TURNED_READ_ONLY = 'Tu distribuidora pasó a solo lectura: ya no se pueden guardar cambios.';

/** Says it once, wherever the form is scrolled, when the distributor stops taking changes. */
function useReadOnlyAnnouncement(readOnly: boolean): void {
  const wasReadOnly = useRef(readOnly);
  useEffect(() => {
    if (readOnly && !wasReadOnly.current) toast.info(TURNED_READ_ONLY);
    wasReadOnly.current = readOnly;
  }, [readOnly]);
}

type ProfileEditFormProps = {
  distributor: Distributor;
  /**
   * The distributor is read-only (suspended, past due, trial over): the fields show what is
   * stored and nothing can be saved. If it turns so with the form half edited, what was typed
   * stays on screen.
   */
  readOnly: boolean;
  /** The form as typed so far, so the live sample beside it can follow. */
  onPreview: (form: ProfileEditForm) => void;
  onSaved: (isBackInReview: boolean) => void;
};

/**
 * Owner edit of the public profile (PLAN 2.11). Only what changed is sent. An edit of the name,
 * of a phone or of the address on an approved listing asks once more before saving, saying what
 * it costs.
 */
export function ProfileEditFormPanel(props: ProfileEditFormProps) {
  const { distributor, readOnly, onPreview, onSaved } = props;
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(() => profileEditFormOf(distributor));
  const [errors, setErrors] = useState<ProfileEditErrors>({});
  const [isConfirming, setConfirming] = useState(false);
  const [lastEdited, setLastEdited] = useState<IdentityInput | null>(null);
  useFocusFirstInvalid(formRef, errors);
  useReadOnlyAnnouncement(readOnly);

  const patch = profilePatchOf(form, distributor);
  const noticeAt = readOnly ? null : identityNoticeFieldOf(patch, lastEdited);
  const leavesTheSearch = noticeAt !== null && distributor.listingApproved;
  const identityNotice = distributor.listingApproved ? BACK_TO_REVIEW : STILL_IN_REVIEW;

  const set: SetProfileField = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    onPreview(next);
    setConfirming(false);
    if (isIdentityInput(field)) setLastEdited(field);
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
    if (readOnly) return undefined;
    if (!hasChanges(patch)) return setErrors({ form: NOTHING_CHANGED });
    const problems = validateProfileEdit(patch);
    setErrors(problems);
    if (Object.keys(problems).length > 0 || !isOnline) return undefined;
    if (leavesTheSearch && !isConfirming) return setConfirming(true);
    return save();
  };

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-8">
      <ProfileFields
        form={form}
        errors={errors}
        set={set}
        identityNotice={noticeAt === null ? null : identityNotice}
        noticeAt={noticeAt}
        disabled={readOnly}
      />
      {!readOnly && (
        <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      )}
      <ProfileEditActions
        readOnly={readOnly}
        hasUnsaved={hasChanges(patch)}
        isConfirming={isConfirming}
        cost={BACK_TO_REVIEW}
        isRunning={isRunning}
        isOnline={isOnline}
        onKeepEditing={() => setConfirming(false)}
      />
    </form>
  );
}
