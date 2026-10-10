import { useNavigate } from 'react-router';
import { Button } from '@/components/common/button';
import { signInWithGoogle } from '@/features/auth/auth-actions';
import { describeAuthError } from '@/features/auth/auth-messages';
import { useAsyncAction } from '@/lib/use-async-action';

// The official "G", in its four colours and untouched: the one colour exception outside the
// tokens (ui-system §1). It lives in public/ as its own file.
const GOOGLE_MARK = '/google-g.svg';

type GoogleButtonProps = {
  /** Where to go once signed in. */
  after: string;
  disabled?: boolean;
  onError: (message: string) => void;
};

/**
 * "Continuar con Google". A new Google account has no profile yet: the guards send it to the
 * terms step, where the person accepts by choice (nothing is accepted on its behalf here).
 */
export function GoogleButton({ after, disabled, onError }: GoogleButtonProps) {
  const navigate = useNavigate();
  const { isRunning, run } = useAsyncAction();

  const start = () =>
    void run(async () => {
      try {
        const session = await signInWithGoogle();
        // Null: the browser is leaving for Google and comes back to this same page.
        if (session) await navigate(after, { replace: true });
      } catch (error) {
        onError(describeAuthError(error));
      }
    });

  return (
    <div>
      <Button
        type="button"
        variant="line"
        className="w-full"
        loading={isRunning}
        loadingLabel="Abriendo Google…"
        disabled={disabled}
        onClick={start}
      >
        <img src={GOOGLE_MARK} alt="" width={20} height={20} className="size-5 shrink-0" />
        Continuar con Google
      </Button>
      {/* What Google hands over (privacy policy §5). The photo arrives with the account and is
          neither shown nor used. */}
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Google nos dará tu nombre, tu correo y tu foto de perfil. La foto no la usamos.
      </p>
    </div>
  );
}
