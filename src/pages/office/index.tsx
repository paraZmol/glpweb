import { AppShell } from '@/components/layout/app-shell';
import { RequireAccess } from '@/components/layout/require-access';

export { OfficeHomePage } from './home';

export const OfficeGate = () => <RequireAccess gate="office" />;
export const OfficeShell = () => <AppShell area="office" />;
