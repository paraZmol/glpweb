import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextLink } from '@/components/common/text-link';
import { isAuthError } from '@/domain/auth/errors';
import { AccountInUseError } from '@/domain/tenancy/errors';
import { discardUnacceptedAccount } from '@/features/auth/auth-actions';
import { describeAuthError } from '@/features/auth/auth-messages';
import { describeTenancyError } from '@/features/tenancy/tenancy-messages';
import { ROUTES } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';

const IN_USE_TEXT = 'Tu cuenta ya tiene datos guardados, así que no se puede eliminar desde aquí.';
const RECENT_LOGIN_TEXT =
  'Por seguridad, antes de eliminar la cuenta tienes que ingresar otra vez. Cierra sesión arriba, vuelve a ingresar y repite este paso.';

type Failure = { text: string; withContactLink: boolean };

function failureOf(error: unknown): Failure {
  if (error instanceof AccountInUseError) return { text: IN_USE_TEXT, withContactLink: true };
  if (isAuthError(error, 'recentLoginRequired')) {
    return { text: RECENT_LOGIN_TEXT, withContactLink: false };
  }
  const text = isAuthError(error) ? describeAuthError(error) : describeTenancyError(error);
  return { text, withContactLink: false };
}

/**
 * "No acepto: eliminar mi cuenta" (PLAN 2.9): the way out for somebody who does not accept the
 * terms. It asks once more before deleting, because it cannot be undone. When it works the
 * session ends and the app restarts by itself, signed out.
 */
export function DiscardAccount({ uid, disabled }: { uid: string; disabled: boolean }) {
  const navigate = useNavigate();
  const { isRunning, run } = useAsyncAction();
  const [isConfirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const discard = () =>
    void run(async () => {
      try {
        await discardUnacceptedAccount(uid);
        // The session is gone: leave before the guard asks to sign in "to continue".
        await navigate(ROUTES.home, { replace: true });
      } catch (error) {
        setFailure(failureOf(error));
        setConfirming(false);
      }
    });

  if (!isConfirming) {
    return (
      <div className="flex flex-col items-start gap-3">
        {failure && (
          <InlineAlert tone="error">
            {failure.text}{' '}
            {failure.withContactLink && (
              <>
                Escribe a <TextLink to={ROUTES.contact}>Contacto y reclamos</TextLink>.
              </>
            )}
          </InlineAlert>
        )}
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="-ml-4"
          disabled={disabled}
          onClick={() => setConfirming(true)}
        >
          No acepto: eliminar mi cuenta
        </Button>
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby="descartar-cuenta" className="rounded-lg bg-muted p-4">
      <p id="descartar-cuenta" className="font-heading text-lg font-bold text-foreground">
        ¿Eliminar tu cuenta?
      </p>
      <p className="mt-1 text-muted-foreground">
        Se borra tu cuenta de Hornilla y no se puede deshacer. Puedes crear otra cuando quieras.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="ink"
          size="sm"
          loading={isRunning}
          loadingLabel="Eliminando tu cuenta…"
          onClick={discard}
        >
          Sí, eliminar mi cuenta
        </Button>
        <Button
          type="button"
          variant="line"
          size="sm"
          disabled={isRunning}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
