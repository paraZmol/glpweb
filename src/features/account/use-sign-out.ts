import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ROUTES } from '../../lib/routes';
import { useAsyncAction } from '../../lib/use-async-action';
import { describeAuthError } from '../auth/auth-messages';
import { endSession, restartApp } from './end-session';

const UNSENT_TEXT =
  'Hay cambios que todavía no se enviaron porque no hay conexión. Si cierras sesión ahora, se pierden.';
const SIGN_OUT_ANYWAY = 'Cerrar sesión igual';

/**
 * Signs out on purpose and clears what the account left on this device (PLAN 2.9). It leaves
 * for the public home FIRST: otherwise the guard of the area would see a signed-out visitor
 * and send the person to "ingresa para continuar". The page then reloads at the home.
 * If changes made offline were never sent, it stops and says so, with the choice of signing out
 * anyway (`signOutDiscardingChanges`).
 */
export function useSignOut() {
  const navigate = useNavigate();
  const { isRunning, run } = useAsyncAction();

  // The warning offers to try again; the ref lets its button reach the latest `leave`.
  const leaveAgain = useRef<(discardUnsent: boolean) => void>(() => {});

  const leave = useCallback(
    (discardUnsent: boolean) => {
      void run(async () => {
        try {
          const outcome = await endSession({
            discardUnsent,
            beforeSignOut: () => navigate(ROUTES.home),
          });
          if (outcome === 'ended') {
            restartApp(ROUTES.home);
            return;
          }
          toast.warning(UNSENT_TEXT, {
            action: { label: SIGN_OUT_ANYWAY, onClick: () => leaveAgain.current(true) },
          });
        } catch (error) {
          toast.error(describeAuthError(error));
        }
      });
    },
    [navigate, run],
  );

  useEffect(() => {
    leaveAgain.current = leave;
  }, [leave]);

  const signOut = useCallback(() => leave(false), [leave]);
  const signOutDiscardingChanges = useCallback(() => leave(true), [leave]);

  return { signOut, signOutDiscardingChanges, isSigningOut: isRunning };
}
