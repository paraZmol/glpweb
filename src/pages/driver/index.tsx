import { AppShell } from '@/components/layout/app-shell';
import { RequireAccess } from '@/components/layout/require-access';
import { useLiveDistributor } from '@/features/tenancy/live-distributor';

export { DriverHomePage } from './home';

export const DriverGate = () => <RequireAccess gate="driver" />;
/** A suspension or a change of role reaches the driver without reloading (PLAN 2.11). */
export function DriverShell() {
  useLiveDistributor();
  return <AppShell area="driver" />;
}
