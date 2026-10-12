import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './router';
import { followSystemTheme } from './lib/theme';
import './index.css';

followSystemTheme();

// Browser tests open their sessions through a test-only entry (PLAN 2.1). The switch is
// decided when the app is built: without it this branch, and the file it loads, are not in
// the bundle at all. `scripts/check-dist.mjs` checks that before every deploy.
if (import.meta.env.VITE_E2E_SIGN_IN === 'true') {
  void import('./features/auth/e2e-entry').then((entry) => entry.installE2eSignIn());
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
