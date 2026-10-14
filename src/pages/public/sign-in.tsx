import { useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { FormStatus } from '@/components/account/form-parts';
import { GoogleButton } from '@/components/account/google-button';
import { Highlight } from '@/components/brand/highlight';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextLink } from '@/components/common/text-link';
import { AuthFrame } from '@/components/layout/auth-frame';
import { SIGN_IN_REQUIRED } from '@/components/layout/require-access';
import { useSession } from '@/features/auth/use-session';
import { usePageTitle } from '@/lib/page-title';
import { RETURN_PARAM, ROUTES, safeReturnPath } from '@/lib/routes';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para ingresar necesitas internet.';

function cameFromGuard(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'notice' in state
    ? state.notice === SIGN_IN_REQUIRED
    : false;
}

type EntryMode = 'signIn' | 'register';

/**
 * The two addresses say the same thing to two kinds of visitor: with Google as the only way
 * in (PLAN 2.1) the first sign-in is what creates the account, so there is no form to tell
 * them apart. Only the words change, and neither screen links to the other: it would be the
 * same button under another title (PLAN §11, 2026-10-14).
 */
const COPY = {
  signIn: {
    pageTitle: 'Ingresar',
    title: 'Ingresa a',
    lead: 'Ingresas con tu cuenta de Google. Para buscar distribuidoras y ver sus páginas no necesitas cuenta.',
  },
  register: {
    pageTitle: 'Crear cuenta',
    title: 'Crea tu cuenta en',
    lead: 'Necesitas una cuenta de Google: es la única forma de entrar y no hay contraseña que crear. La misma cuenta te sirve como cliente y para trabajar con tu distribuidora. Sigue: confirmar tus datos y aceptar los términos. Si ya tienes cuenta, el mismo botón te hace ingresar.',
  },
} as const;

/**
 * `/ingresar` and `/registro` (PLAN 2.1): "Continuar con Google" and nothing else. Where the
 * visitor was going (`desde`) is kept through the sign-in and, for a new account, through the
 * terms step.
 */
function EntryPage({ mode }: { mode: EntryMode }) {
  const copy = COPY[mode];
  usePageTitle(copy.pageTitle);
  const session = useSession();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string>();
  const target = safeReturnPath(searchParams.get(RETURN_PARAM));
  const after = target ?? ROUTES.appEntry;

  if (session.status === 'signedIn') return <Navigate to={after} replace />;

  return (
    <AuthFrame
      title={
        <>
          {copy.title} <Highlight>Hornilla.</Highlight>
        </>
      }
      lead={copy.lead}
    >
      {cameFromGuard(location.state) && (
        <InlineAlert tone="info" className="mb-6">
          Ingresa para continuar.
        </InlineAlert>
      )}
      <div className="flex flex-col gap-5">
        <GoogleButton after={after} disabled={!isOnline} onError={setError} />
        <FormStatus error={error} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
        {/* Entering accepts nothing: a new account accepts, by choice, on the next step, where it
            can also delete the account it just created. */}
        <p className="text-[0.9375rem] text-muted-foreground">
          Al continuar se crea tu cuenta de ingreso con el nombre y el correo que entrega Google.
          Los{' '}
          <TextLink to={ROUTES.terms} newTab>
            Términos y condiciones
          </TextLink>{' '}
          y la{' '}
          <TextLink to={ROUTES.privacy} newTab>
            Política de privacidad
          </TextLink>{' '}
          se aceptan en el paso siguiente, la primera vez que ingresas; si no los aceptas, ahí mismo
          puedes eliminar la cuenta.
        </p>
      </div>
    </AuthFrame>
  );
}

export const SignInPage = () => <EntryPage mode="signIn" />;
export const RegisterPage = () => <EntryPage mode="register" />;
