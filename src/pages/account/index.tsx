// What every signed-in route shares: the account read once, the guards and the pending step.
import { Outlet } from 'react-router';
import { RequireAccess } from '@/components/layout/require-access';
import { AccountProvider } from '@/features/account/account-provider';

export { GateShell } from '@/components/layout/gate-shell';
export { AcceptTermsPage } from './accept-terms';

/** Parent of every route that needs a session: its children read the account from context. */
export function AccountLayout() {
  return (
    <AccountProvider>
      <Outlet />
    </AccountProvider>
  );
}

/** `/app`: never shows a screen of its own, it sends the account to the area of its role. */
export const HomeGate = () => <RequireAccess gate="home" />;
export const AcceptTermsGate = () => <RequireAccess gate="acceptTerms" />;
