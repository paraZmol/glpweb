import { type FormEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { TextField } from '@/components/common/text-field';
import { TextLink } from '@/components/common/text-link';
import { DISPLAY_NAME_MAX_LENGTH } from '@/domain/tenancy/constants';
import type { UserProfile } from '@/domain/tenancy/types';
import { saveProfile } from '@/features/auth/auth-actions';
import {
  hasErrors,
  type ProfileErrors,
  profileErrorsOf,
  validateProfile,
} from '@/features/auth/auth-forms';
import { ROUTES } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para guardar los cambios necesitas internet.';

type ProfileFormProps = {
  uid: string;
  profile: UserProfile;
  email: string | null;
  /** Called after the profile was stored, to read it again. */
  onSaved: () => void;
};

/** Name and phone of the account. The e-mail is shown but belongs to the sign-in, not to this form. */
export function ProfileForm({ uid, profile, email, onSaved }: ProfileFormProps) {
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [errors, setErrors] = useState<ProfileErrors>({});
  useFocusFirstInvalid(formRef, errors);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems = validateProfile({ displayName, phone });
    setErrors(problems);
    if (hasErrors(problems) || !isOnline) return;
    void run(async () => {
      try {
        await saveProfile(uid, { displayName, phone });
        toast.success('Guardamos tus datos.');
        onSaved();
      } catch (error) {
        setErrors(profileErrorsOf(error));
      }
    });
  };

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">Tus datos</h2>
      <TextField
        label="Nombre"
        name="displayName"
        autoComplete="name"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        error={errors.displayName}
      />
      <TextField
        label="Celular (opcional)"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={errors.phone}
        hint="9 dígitos. Lo ve la distribuidora a la que le pidas, para coordinar la entrega."
      />
      <TextField
        label="Correo"
        name="email"
        type="email"
        value={email ?? ''}
        readOnly
        hint={
          <>
            Con este correo ingresas. Para eliminar tu cuenta o cambiar tu correo, escribe a{' '}
            <TextLink to={ROUTES.contact}>Contacto y reclamos</TextLink>.
          </>
        }
      />
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <Button
        type="submit"
        className="self-start"
        loading={isRunning}
        loadingLabel="Guardando…"
        disabled={!isOnline}
      >
        Guardar cambios
      </Button>
    </form>
  );
}
