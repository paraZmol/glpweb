import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AreaLoading } from './components/layout/area-loading';
import { PublicShell } from './components/layout/public-shell';
import { RootLayout } from './components/layout/root-layout';
import { RouteError } from './components/layout/route-error';
import { ROUTES } from './lib/routes';
import { HomePage } from './pages/public/home';

// One chunk per area (PLAN 2.4): only the home travels with the first load, so the initial
// JavaScript stays under the 200 KB gzip budget. Firebase arrives with the first chunk that
// needs the session or the database (the search of the home loads it once there is a point).
const areas = {
  public: () => import('./pages/public'),
  account: () => import('./pages/account'),
  customer: () => import('./pages/customer'),
  driver: () => import('./pages/driver'),
  office: () => import('./pages/office'),
  platform: () => import('./pages/platform'),
};

type Areas = typeof areas;
type AreaModule<Area extends keyof Areas> = Awaited<ReturnType<Areas[Area]>>;

/** Route `lazy` that takes one component out of the chunk of its area. */
function from<Area extends keyof Areas>(
  area: Area,
  pick: (module: AreaModule<Area>) => ComponentType,
) {
  return async () => ({ Component: pick((await areas[area]()) as AreaModule<Area>) });
}

/** A guard, the frame of its area inside it, and the screens inside the frame. */
function guarded<Area extends keyof Areas>(
  area: Area,
  gate: (module: AreaModule<Area>) => ComponentType,
  shell: (module: AreaModule<Area>) => ComponentType,
  children: RouteObject[],
): RouteObject {
  return { lazy: from(area, gate), children: [{ lazy: from(area, shell), children }] };
}

const publicRoutes: RouteObject = {
  element: <PublicShell />,
  children: [
    { index: true, element: <HomePage /> },
    { path: ROUTES.signIn, lazy: from('public', (m) => m.SignInPage) },
    { path: ROUTES.register, lazy: from('public', (m) => m.RegisterPage) },
    { path: ROUTES.resetPassword, lazy: from('public', (m) => m.ResetPasswordPage) },
    { path: ROUTES.terms, lazy: from('public', (m) => m.TermsPage) },
    { path: ROUTES.privacy, lazy: from('public', (m) => m.PrivacyPage) },
    { path: ROUTES.cookies, lazy: from('public', (m) => m.CookiesPage) },
    { path: ROUTES.contact, lazy: from('public', (m) => m.ContactPage) },
    { path: ROUTES.distributor, lazy: from('public', (m) => m.DistributorPage) },
    { path: '*', lazy: from('public', (m) => m.NotFoundPage) },
  ],
};

const accountRoutes: RouteObject = {
  lazy: from('account', (m) => m.AccountLayout),
  children: [
    { path: ROUTES.appEntry, lazy: from('account', (m) => m.HomeGate) },
    guarded(
      'account',
      (m) => m.VerifyEmailGate,
      (m) => m.GateShell,
      [{ path: ROUTES.verifyEmail, lazy: from('account', (m) => m.VerifyEmailPage) }],
    ),
    guarded(
      'account',
      (m) => m.AcceptTermsGate,
      (m) => m.GateShell,
      [{ path: ROUTES.acceptTerms, lazy: from('account', (m) => m.AcceptTermsPage) }],
    ),
    guarded(
      'customer',
      (m) => m.CustomerGate,
      (m) => m.CustomerShell,
      [
        { path: ROUTES.customerHome, lazy: from('customer', (m) => m.CustomerHomePage) },
        { path: ROUTES.customerOrders, lazy: from('customer', (m) => m.CustomerOrdersPage) },
        { path: ROUTES.account, lazy: from('customer', (m) => m.AccountPage) },
      ],
    ),
    // Any verified account may found a distributor (PLAN 2.2): the wizard has its own frame.
    guarded(
      'customer',
      (m) => m.CustomerGate,
      (m) => m.FocusShell,
      [{ path: ROUTES.newDistributor, lazy: from('customer', (m) => m.NewDistributorPage) }],
    ),
    guarded(
      'driver',
      (m) => m.DriverGate,
      (m) => m.DriverShell,
      [{ path: ROUTES.driverHome, lazy: from('driver', (m) => m.DriverHomePage) }],
    ),
    guarded(
      'office',
      (m) => m.OfficeGate,
      (m) => m.OfficeShell,
      [{ path: ROUTES.officeHome, lazy: from('office', (m) => m.OfficeHomePage) }],
    ),
    guarded(
      'platform',
      (m) => m.PlatformGate,
      (m) => m.PlatformShell,
      [{ path: ROUTES.platformHome, lazy: from('platform', (m) => m.PlatformHomePage) }],
    ),
  ],
};

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: (
      <div className="flex min-h-dvh flex-col">
        <AreaLoading />
      </div>
    ),
    children: [publicRoutes, accountRoutes],
  },
]);
