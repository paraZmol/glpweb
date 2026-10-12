import { AppShell } from '@/components/layout/app-shell';
import { RequireAccess } from '@/components/layout/require-access';
import { useLiveDistributor } from '@/features/tenancy/live-distributor';

export { EditProfilePage } from './edit-profile';
export { OfficeHomePage } from './home';

export const OfficeGate = () => <RequireAccess gate="office" />;
/** Every screen of the office follows its distributor live while it is open (PLAN 2.11). */
export function OfficeShell() {
  useLiveDistributor();
  return <AppShell area="office" />;
}
