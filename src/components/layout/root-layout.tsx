import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { toast } from 'sonner';
import { AppToaster } from '@/components/common/app-toaster';
import { OfflineBanner } from '@/components/common/offline-banner';
import { StorageNotice } from '@/components/common/storage-notice';
import { NavigationProgress } from '@/components/motion/navigation-progress';
import { useCurrentPageTitle } from '@/lib/page-title';

const REDIRECT_TOAST_ID = 'google-redirect';
let hasFinishedGoogleRedirect = false;

/**
 * Completes a Google sign-in that left for a full-page redirect (PLAN 2.1). Once per load, and
 * after the first paint: Firebase is fetched apart so it never delays the landing page.
 */
function useFinishGoogleRedirectOnce() {
  useEffect(() => {
    if (hasFinishedGoogleRedirect) return;
    hasFinishedGoogleRedirect = true;
    void (async () => {
      const [actions, messages] = await Promise.all([
        import('@/features/auth/auth-actions'),
        import('@/features/auth/auth-messages'),
      ]);
      try {
        await actions.finishGoogleRedirect();
      } catch (error) {
        toast.error(messages.describeAuthError(error), { id: REDIRECT_TOAST_ID });
      }
    })();
  }, []);
}

/** Says the name of the new screen to screen readers after each navigation. */
function RouteAnnouncer() {
  const title = useCurrentPageTitle();
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {title}
    </p>
  );
}

/**
 * The one frame around every screen: motion settings, skip link, offline banner, navigation
 * bar, toasts, storage notice and scroll position kept when going back.
 */
export function RootLayout() {
  useFinishGoogleRedirectOnce();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-full bg-foreground px-4 py-2 font-semibold text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        <div className="flex min-h-dvh flex-col">
          <OfflineBanner />
          <NavigationProgress />
          <Outlet />
        </div>
        <RouteAnnouncer />
        <StorageNotice />
        <AppToaster />
        <ScrollRestoration />
      </MotionConfig>
    </LazyMotion>
  );
}
