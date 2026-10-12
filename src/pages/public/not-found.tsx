import { BurnerRing } from '@/components/brand/burner-ring';
import { Highlight } from '@/components/brand/highlight';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { ButtonLink } from '@/components/common/button';
import { useSession } from '@/features/auth/use-session';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

const SYMBOL_PX = 72;

/**
 * The ways on from an address that does not exist. Whoever is signed in is taken to the area of
 * their role, never asked to sign in again; while the session is still unknown only the way
 * that suits everybody shows, so no button appears to be taken away a moment later.
 */
function WaysOn() {
  const session = useSession();
  if (session.status === 'signedIn') {
    return (
      <>
        <ButtonLink to={ROUTES.appEntry} variant="primary" size="lg">
          Ir a mi inicio
        </ButtonLink>
        <ButtonLink to={ROUTES.home} variant="line" size="lg">
          Ver la portada
        </ButtonLink>
      </>
    );
  }
  return (
    <>
      <ButtonLink to={ROUTES.home} variant="primary" size="lg">
        Ir al inicio
      </ButtonLink>
      {session.status === 'signedOut' && (
        <ButtonLink to={ROUTES.signIn} variant="line" size="lg">
          Ingresar
        </ButtonLink>
      )}
    </>
  );
}

/** Any address the app does not know. Says so and offers the usual ways on. */
export function NotFoundPage() {
  usePageTitle('Página no encontrada');
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 content-center gap-12 px-4 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-8 lg:py-24">
      <section>
        <p className="font-heading text-lg font-bold text-muted-foreground tabular-nums">
          Error 404
        </p>
        <h1 className="mt-2 text-[2.625rem] font-extrabold text-balance lg:text-7xl">
          Esta página <Highlight>no existe.</Highlight>
        </h1>
        <p className="mt-5 max-w-120 text-lg text-muted-foreground lg:text-xl">
          Puede que el enlace esté mal escrito o que la página haya cambiado de lugar. Tu gas sigue
          donde siempre.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <WaysOn />
        </div>
      </section>
      <div aria-hidden="true" className="relative mx-auto hidden size-72 lg:block">
        <BurnerRing className="-top-6 -right-10 size-60" />
        <div className="relative grid size-full place-items-center rounded-2xl bg-card shadow-float">
          <span className="text-muted-foreground">
            <HornillaLogo variant="symbol" tone="mono" size={SYMBOL_PX} />
          </span>
        </div>
      </div>
    </div>
  );
}
