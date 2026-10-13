import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/common/button';
import { ConfirmPanel } from '@/components/common/confirm-panel';
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
// It names the button of the header as that header (`GateShell`) writes it.
const RECENT_LOGIN_TEXT =
  'Por seguridad, antes de eliminar la cuenta tienes que ingresar otra vez. Toca "Cerrar sesión" (arriba), vuelve a ingresar y repite este paso.';

type Failure = { text: string; withContactLink: boolean };

function failureOf(error: unknown): Failure {
  if (error instanceof AccountInUseError) return { text: IN_USE_TEXT, withContactLink: true };
  if (isAuthError(error, 'recentLoginRequired')) {
    return { text: RECENT_LOGIN_TEXT, withContactLink: false };
  }
  const text = isAuthError(error) ? describeAuthError(error) : describeTenancyError(error);
  return { text, withContactLink: false };
}

const LABEL = 'No quiero continuar: eliminar mi cuenta';

type DiscardAccountProps = {
  uid: string;
  disabled: boolean;
};

/**
 * "No quiero continuar: eliminar mi cuenta" (PLAN 2.1, 2.9): the way out for somebody who signed
 * in for the first time and does not accept the terms. Only for an account without a profile.
 * It asks once more before deleting, because it cannot be undone.
 * When it works the session ends and the app restarts by itself, signed out.
 */
export function DiscardAccount({ uid, disabled }: DiscardAccountProps) {
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
          {LABEL}
        </Button>
      </div>
    );
  }

  return (
    <ConfirmPanel
      title="¿Eliminar tu cuenta?"
      actions={
        <>
          <Button
            type="button"
            variant="line"
            size="sm"
            disabled={isRunning}
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
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
        </>
      }
    >
      <p className="mt-1 text-muted-foreground">
        Se borra tu cuenta de Hornilla y no se puede deshacer. Podrás volver a entrar con esta misma
        cuenta de Google cuando quieras.
      </p>
    </ConfirmPanel>
  );
}
