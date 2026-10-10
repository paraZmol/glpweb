import { AppShell } from '@/components/layout/app-shell';
import { RequireAccess } from '@/components/layout/require-access';

export { DriverHomePage } from './home';

export const DriverGate = () => <RequireAccess gate="driver" />;
export const DriverShell = () => <AppShell area="driver" />;
