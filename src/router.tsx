import { createBrowserRouter } from 'react-router';
import { ComingSoonPage } from './pages/public/coming-soon';

export const router = createBrowserRouter([{ path: '*', element: <ComingSoonPage /> }]);
