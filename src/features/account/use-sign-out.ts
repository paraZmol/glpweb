import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAsyncAction } from '../../lib/use-async-action';
import { ROUTES } from '../../lib/routes';
import { signOut as signOutSession } from '../auth/auth-actions';
import { describeAuthError } from '../auth/auth-messages';

/**
 * Signs out on purpose. It leaves for the public home FIRST: otherwise the guard of the area
 * would see a signed-out visitor and send the person to "ingresa para continuar".
 */
export function useSignOut() {
  const navigate = useNavigate();
  const { isRunning, run } = useAsyncAction();

  const signOut = useCallback(() => {
    void run(async () => {
      try {
        await navigate(ROUTES.home);
        await signOutSession();
      } catch (error) {
        toast.error(describeAuthError(error));
      }
    });
  }, [navigate, run]);

  return { signOut, isSigningOut: isRunning };
}
