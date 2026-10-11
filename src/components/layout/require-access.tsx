import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/common/button';
import { ErrorState } from '@/components/common/state-views';
import { type AccessGate, decideAccess } from '@/domain/auth/access';
import { accessInputFor } from '@/features/account/access-input';
import { type AccountGateValue, useAccountGate } from '@/features/account/account-context';
import { signOut } from '@/features/auth/auth-actions';
import { AREA_HOME, destinationOf, destinationState, ROUTES, signInPathFrom } from '@/lib/routes';
import { AreaLoading } from './area-loading';

const DENIED_NOTICE = 'Esa sección no está disponible para tu cuenta. Te llevamos a la tuya.';
const DENIED_TOAST_ID = 'access-denied';
/** Told to the sign-in screen through the navigation state, so it can explain the detour. */
export const SIGN_IN_REQUIRED = 'signInRequired';

/** Leaves an area the account has no role for, saying why (never a blank page). */
function DeniedRedirect({ to }: { to: string }) {
  useEffect(() => {
    toast.info(DENIED_NOTICE, { id: DENIED_TOAST_ID });
  }, []);
  return <Navigate to={to} replace />;
}

function reloadAll(account: AccountGateValue) {
  account.profile.reload();
  account.platformAdmin.reload();
  if (account.current.status === 'error') account.current.reload();
}

function AccessError({ account }: { account: AccountGateValue }) {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <ErrorState
        title="No pudimos cargar tu cuenta."
        description="Puede ser la conexión. Tus datos siguen guardados: vuelve a intentar en un momento."
        onRetry={() => reloadAll(account)}
        secondaryAction={
          <Button variant="line" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        }
      />
    </div>
  );
}

/**
 * Guard of a group of routes (PLAN 2.4). The decision is `decideAccess`, a pure function with
 * its own tests; this component only turns it into a skeleton, a redirect or the screen.
 * It hides screens, nothing more: the security rules are what protects the data.
 */
export function RequireAccess({ gate }: { gate: AccessGate }) {
  const account = useAccountGate();
  const location = useLocation();
  const decision = decideAccess(accessInputFor(gate, account));

  const from = `${location.pathname}${location.search}`;
  const isPendingStep = gate === 'verifyEmail' || gate === 'acceptTerms';

  if (decision.kind === 'wait') return <AreaLoading />;
  if (decision.kind === 'error') return <AccessError account={account} />;
  if (decision.kind === 'allow') return <Outlet />;
  if (decision.to === 'area') {
    const home = AREA_HOME[decision.area];
    if (decision.denied) return <DeniedRedirect to={home} />;
    // A finished step goes on to where the account was heading before it (PLAN 2.11).
    const after = isPendingStep ? destinationOf(location.state) : null;
    return <Navigate to={after ?? home} replace />;
  }
  if (decision.to === 'acceptTerms' || decision.to === 'verifyEmail') {
    // The destination rides along in the navigation state: from one step to the next, or from
    // the screen that was asked for.
    const after = isPendingStep ? destinationOf(location.state) : from;
    return <Navigate to={ROUTES[decision.to]} replace state={destinationState(after)} />;
  }
  return <Navigate to={signInPathFrom(from)} replace state={{ notice: SIGN_IN_REQUIRED }} />;
}
