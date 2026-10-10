import { AppShell } from '@/components/layout/app-shell';
import { RequireAccess } from '@/components/layout/require-access';

export { AccountPage } from './account';
export { CustomerHomePage } from './home';
export { CustomerOrdersPage } from './orders';

export const CustomerGate = () => <RequireAccess gate="customer" />;
export const CustomerShell = () => <AppShell area="customer" />;
