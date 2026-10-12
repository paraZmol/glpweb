import { type FormEvent, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
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
import { verificationSentState } from '@/lib/resend-wait';
import {
  destinationState,
  RETURN_PARAM,
  ROUTES,
  safeReturnPath,
  signInPathFrom,
} from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para crear tu cuenta necesitas internet.';
const EMPTY_FORM: RegistrationForm = { displayName: '', email: '', password: '', phone: '' };

/**
 * `/registro` (PLAN 2.1, 2.11): creates the sign-in account and nothing else. The terms are
 * accepted two steps later, once the e-mail is verified; where the visitor was going (`desde`)
 * travels with the account through both steps.
 */
export function RegisterPage() {
  usePageTitle('Crear cuenta');
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  // This screen stays mounted while it leaves (exit transition): once it has registered it must
  // not send the new session anywhere else, or the verification screen loses what it was told.
  const [hasRegistered, setRegistered] = useState(false);
  useFocusFirstInvalid(formRef, errors);
  const target = safeReturnPath(searchParams.get(RETURN_PARAM));
  const after = target ?? ROUTES.appEntry;

  if (session.status === 'signedIn' && !isRunning && !hasRegistered) {
    return <Navigate to={after} replace />;
  }

  const set: SetRegistrationField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems = validateRegistration(form);
    setErrors(problems);
    if (hasErrors(problems) || !isOnline) return;
    void run(async () => {
      try {
        await registerAccount(form);
        setRegistered(true);
        // The verification screen makes "resend" wait from the moment this e-mail left.
        const state = { ...verificationSentState(Date.now()), ...destinationState(target) };
        await navigate(ROUTES.verifyEmail, { replace: true, state });
      } catch (error) {
        setErrors(registrationErrorsOf(error));
      }
    });
  };

  return (
    <AuthFrame
      title={
        <>
          Crea tu cuenta en <Highlight>Hornilla.</Highlight>
        </>
      }
      lead="Te toma un minuto. La misma cuenta te sirve como cliente y para trabajar con tu distribuidora."
      footer={
        <p>
          ¿Ya tienes cuenta? <TextLink to={signInPathFrom(target ?? '')}>Ingresar</TextLink>
        </p>
      }
    >
      <GoogleButton
        after={after}
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
        {/* The whole way in one line, so nobody expects to be done after this button. */}
        <p className="-mt-2 text-center text-sm text-muted-foreground">
          Sigue: verificar tu correo y aceptar los términos.
        </p>
      </form>
    </AuthFrame>
  );
}
