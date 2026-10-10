import { useNavigate } from 'react-router';
import { Button } from '@/components/common/button';
import { signInWithGoogle } from '@/features/auth/auth-actions';
import { describeAuthError } from '@/features/auth/auth-messages';
import { useAsyncAction } from '@/lib/use-async-action';

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
    <Button
      type="button"
      variant="line"
      className="w-full"
      loading={isRunning}
      loadingLabel="Abriendo Google…"
      disabled={disabled}
      onClick={start}
    >
      Continuar con Google
    </Button>
  );
}
