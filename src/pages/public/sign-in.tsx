import { type FormEvent, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { FormStatus, OrDivider } from '@/components/account/form-parts';
import { GoogleButton } from '@/components/account/google-button';
import { Highlight } from '@/components/brand/highlight';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { PasswordField } from '@/components/common/password-field';
import { TextField } from '@/components/common/text-field';
import { TextLink } from '@/components/common/text-link';
import { AuthFrame } from '@/components/layout/auth-frame';
import { SIGN_IN_REQUIRED } from '@/components/layout/require-access';
import { signIn } from '@/features/auth/auth-actions';
import {
  hasErrors,
  type SignInErrors,
  signInErrorsOf,
  validateSignIn,
} from '@/features/auth/auth-forms';
import { useSession } from '@/features/auth/use-session';
import { usePageTitle } from '@/lib/page-title';
import { registerPathFrom, RETURN_PARAM, ROUTES, safeReturnPath } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para ingresar necesitas internet.';

function cameFromGuard(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'notice' in state
    ? state.notice === SIGN_IN_REQUIRED
    : false;
}

export function SignInPage() {
  usePageTitle('Ingresar');
  const session = useSession();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const target = safeReturnPath(searchParams.get(RETURN_PARAM));
  const after = target ?? ROUTES.appEntry;

  if (session.status === 'signedIn') return <Navigate to={after} replace />;

  return (
    <AuthFrame
      title={
        <>
          Ingresa a <Highlight>Hornilla.</Highlight>
        </>
      }
      lead="Tus pedidos, tus direcciones y tu distribuidora te esperan."
      footer={
        <p>
          ¿Primera vez por aquí? <TextLink to={registerPathFrom(target)}>Crear cuenta</TextLink>
        </p>
      }
    >
      {cameFromGuard(location.state) && (
        <InlineAlert tone="info" className="mb-6">
          Ingresa para continuar.
        </InlineAlert>
      )}
      <SignInForm after={after} />
    </AuthFrame>
  );
}

function SignInForm({ after }: { after: string }) {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<SignInErrors>({});
  useFocusFirstInvalid(formRef, errors);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems = validateSignIn({ email, password });
    setErrors(problems);
    if (hasErrors(problems) || !isOnline) return;
    void run(async () => {
      try {
        await signIn(email, password);
        await navigate(after, { replace: true });
      } catch (error) {
        setErrors(signInErrorsOf(error));
      }
    });
  };

  return (
    <>
      <GoogleButton
        after={after}
        disabled={!isOnline || isRunning}
        onError={(form) => setErrors({ form })}
      />
      <OrDivider>o con tu correo</OrDivider>
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label="Correo"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <div>
          <PasswordField
            label="Contraseña"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <p className="mt-2 text-[0.9375rem]">
            <TextLink to={ROUTES.resetPassword}>¿Olvidaste tu contraseña?</TextLink>
          </p>
        </div>
        <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
        <Button type="submit" loading={isRunning} loadingLabel="Ingresando…" disabled={!isOnline}>
          Ingresar
        </Button>
      </form>
    </>
  );
}
