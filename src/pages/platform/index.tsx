import { AppShell } from '@/components/layout/app-shell';
import { RequireAccess } from '@/components/layout/require-access';

export { PlatformHomePage } from './home';

export const PlatformGate = () => <RequireAccess gate="platform" />;
export const PlatformShell = () => <AppShell area="platform" />;
