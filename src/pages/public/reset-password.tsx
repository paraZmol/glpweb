import { MailCheck } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { Button, ButtonLink } from '@/components/common/button';
import { TextField } from '@/components/common/text-field';
import { TextLink } from '@/components/common/text-link';
import { AuthFrame } from '@/components/layout/auth-frame';
import { requestPasswordReset } from '@/features/auth/auth-actions';
import { emailProblemOf, type SignInErrors, signInErrorsOf } from '@/features/auth/auth-forms';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para enviar el enlace necesitas internet.';

export function ResetPasswordPage() {
  usePageTitle('Restablecer contraseña');
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <AuthFrame
      title={sentTo === null ? 'Restablece tu contraseña.' : 'Revisa tu correo.'}
      lead={
        sentTo === null
          ? 'Escribe el correo de tu cuenta y te enviamos un enlace para elegir una nueva.'
          : undefined
      }
      footer={
        <p>
          <TextLink to={ROUTES.signIn}>Volver a ingresar</TextLink>
        </p>
      }
    >
      {sentTo === null ? <ResetForm onSent={setSentTo} /> : <ResetSent email={sentTo} />}
    </AuthFrame>
  );
}

function ResetForm({ onSent }: { onSent: (email: string) => void }) {
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<SignInErrors>({});
  useFocusFirstInvalid(formRef, errors);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const emailProblem = emailProblemOf(email);
    setErrors(emailProblem ? { email: emailProblem } : {});
    if (emailProblem || !isOnline) return;
    void run(async () => {
      try {
        await requestPasswordReset(email);
        onSent(email.trim());
      } catch (error) {
        setErrors(signInErrorsOf(error));
      }
    });
  };

  return (
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
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <Button
        type="submit"
        loading={isRunning}
        loadingLabel="Enviando el enlace…"
        disabled={!isOnline}
      >
        Enviar enlace
      </Button>
    </form>
  );
}

/** The same words whether or not an account uses that address: the screen never tells which. */
function ResetSent({ email }: { email: string }) {
  return (
    <div role="status" className="flex flex-col items-start gap-4">
      <MailCheck aria-hidden="true" className="size-12 text-flame-text" strokeWidth={ICON_STROKE} />
      <p className="text-lg">
        Si hay una cuenta con <strong className="break-all">{email}</strong>, en unos minutos llega
        un enlace para elegir una contraseña nueva.
      </p>
      <p className="text-muted-foreground">
        ¿No aparece? Mira en la carpeta de correo no deseado antes de pedir otro.
      </p>
      <ButtonLink to={ROUTES.signIn} variant="ink">
        Ya la cambié, ingresar
      </ButtonLink>
    </div>
  );
}
