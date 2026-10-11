import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Highlight } from '@/components/brand/highlight';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { AuthFrame } from '@/components/layout/auth-frame';
import { useAccount } from '@/features/account/account-context';
import { refreshSession, resendVerificationEmail } from '@/features/auth/auth-actions';
import { describeAuthError } from '@/features/auth/auth-messages';
import { usePageTitle } from '@/lib/page-title';
import { RESEND_WAIT_SECONDS, resendWaitLeft, verificationSentState } from '@/lib/resend-wait';
import { useAsyncAction } from '@/lib/use-async-action';
import { formatCountdown, useCountdown } from '@/lib/use-countdown';
import { useOnlineStatus } from '@/lib/use-online-status';
import { DiscardAccount } from './discard-account';

type Notice = { tone: 'error' | 'info' | 'success'; text: string };

const SENT: Notice = {
  tone: 'success',
  text: 'Te enviamos otro correo. Puede tardar unos minutos.',
};
const NOT_YET: Notice = {
  tone: 'info',
  text: 'Todavía no figura como verificado. Abre el enlace del correo y vuelve a tocar el botón.',
};
const OFFLINE: Notice = {
  tone: 'info',
  text: 'Sin conexión: para comprobarlo necesitas internet.',
};

/**
 * Pending step: the account exists but its e-mail is not verified. When the check succeeds the
 * session changes and the guard (`RequireAccess`) takes the person on by itself. Nothing is
 * stored for the account yet (PLAN 2.11), so whoever does not want to go on deletes it here.
 */
export function VerifyEmailPage() {
  usePageTitle('Verifica tu correo');
  const { session } = useAccount();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  // What is left of the wait since the last e-mail, also after reloading the screen.
  const [waitAtArrival] = useState(() => resendWaitLeft(location.state, Date.now()));
  const wait = useCountdown(waitAtArrival);
  const resending = useAsyncAction();
  const checking = useAsyncAction();
  const [notice, setNotice] = useState<Notice | null>(null);

  const attempt = async (action: () => Promise<Notice | null>) => {
    try {
      setNotice(await action());
    } catch (error) {
      setNotice({ tone: 'error', text: describeAuthError(error) });
    }
  };

  const resend = () =>
    void resending.run(() =>
      attempt(async () => {
        await resendVerificationEmail();
        wait.start(RESEND_WAIT_SECONDS);
        // The new moment replaces the one of this history entry; where the account was going stays.
        const state = {
          ...(location.state as object | null),
          ...verificationSentState(Date.now()),
        };
        await navigate(location, { replace: true, state });
        return SENT;
      }),
    );

  const check = () =>
    void checking.run(() =>
      attempt(async () => ((await refreshSession())?.emailVerified ? null : NOT_YET)),
    );

  const shown = isOnline ? notice : OFFLINE;

  return (
    <AuthFrame
      title={
        <>
          Verifica <Highlight>tu correo.</Highlight>
        </>
      }
      lead={
        <>
          Enviamos un enlace a{' '}
          <strong className="inline-block max-w-full align-bottom wrap-anywhere text-foreground">
            {session.email}
          </strong>
          . Ábrelo y vuelve aquí: así sabemos que la cuenta es tuya.
        </>
      }
      footer={
        <div className="flex flex-col gap-3 text-muted-foreground">
          <p>¿No llega? Mira en la carpeta de correo no deseado.</p>
          <DiscardAccount
            uid={session.uid}
            disabled={!isOnline || checking.isRunning || resending.isRunning}
            label="No quiero continuar: eliminar mi cuenta"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {shown && <InlineAlert tone={shown.tone}>{shown.text}</InlineAlert>}
        <Button
          loading={checking.isRunning}
          loadingLabel="Comprobando…"
          disabled={!isOnline}
          onClick={check}
        >
          Ya lo verifiqué
        </Button>
        <Button
          variant="line"
          loading={resending.isRunning}
          loadingLabel="Enviando el correo…"
          disabled={!isOnline || wait.isRunning}
          onClick={resend}
        >
          {wait.isRunning ? (
            <span className="tabular-nums">Reenviar en {formatCountdown(wait.secondsLeft)}</span>
          ) : (
            'Reenviar correo'
          )}
        </Button>
      </div>
    </AuthFrame>
  );
}
