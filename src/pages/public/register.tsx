import { type FormEvent, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { FormStatus, OrDivider } from '@/components/account/form-parts';
import { GoogleButton } from '@/components/account/google-button';
import {
  RegistrationFields,
  type SetRegistrationField,
} from '@/components/account/registration-fields';
import { Highlight } from '@/components/brand/highlight';
import { Button } from '@/components/common/button';
import { TextLink } from '@/components/common/text-link';
import { AuthFrame } from '@/components/layout/auth-frame';
import { registerAccount } from '@/features/auth/auth-actions';
import {
  hasErrors,
  type RegistrationErrors,
  registrationErrorsOf,
  type RegistrationForm,
  validateRegistration,
} from '@/features/auth/auth-forms';
import { useSession } from '@/features/auth/use-session';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para crear tu cuenta necesitas internet.';
// Never ticked for the person: both boxes start empty (PLAN 2.7, 2.9).
const EMPTY_FORM: RegistrationForm = {
  displayName: '',
  email: '',
  password: '',
  phone: '',
  acceptTerms: false,
  acceptPrivacy: false,
};
/** Told to the verification screen: an e-mail was sent a moment ago, so "resend" starts waiting. */
export const JUST_REGISTERED = { justRegistered: true };

export function RegisterPage() {
  usePageTitle('Crear cuenta');
  const session = useSession();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  useFocusFirstInvalid(formRef, errors);

  // While the account is being created the session already exists but its profile does not:
  // leaving now would land on the terms step by mistake.
  if (session.status === 'signedIn' && !isRunning) return <Navigate to={ROUTES.appEntry} replace />;

  const set: SetRegistrationField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems = validateRegistration(form);
    setErrors(problems);
    // The boxes are checked again here on purpose: without both nothing is ever sent.
    if (hasErrors(problems) || !form.acceptTerms || !form.acceptPrivacy || !isOnline) return;
    void run(async () => {
      try {
        await registerAccount({ ...form, acceptTerms: true, acceptPrivacy: true });
        await navigate(ROUTES.verifyEmail, { replace: true, state: JUST_REGISTERED });
      } catch (error) {
        setErrors(registrationErrorsOf(error));
      }
    });
  };

  return (
    <AuthFrame
      title={
        <>
          Crea tu cuenta y <Highlight>pide tu gas.</Highlight>
        </>
      }
      lead="Te toma un minuto. La misma cuenta sirve para pedir y para trabajar con tu distribuidora."
      footer={
        <p>
          ¿Ya tienes cuenta? <TextLink to={ROUTES.signIn}>Ingresar</TextLink>
        </p>
      }
    >
      <GoogleButton
        after={ROUTES.appEntry}
        disabled={!isOnline || isRunning}
        onError={(message) => setErrors({ form: message })}
      />
      <OrDivider>o con tu correo</OrDivider>
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-5">
        <RegistrationFields form={form} errors={errors} set={set} />
        <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
        <Button
          type="submit"
          loading={isRunning}
          loadingLabel="Creando tu cuenta…"
          disabled={!isOnline}
        >
          Crear cuenta
        </Button>
      </form>
    </AuthFrame>
  );
}
