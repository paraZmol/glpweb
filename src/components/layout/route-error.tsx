import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { ButtonLink } from '@/components/common/button';
import { ErrorState } from '@/components/common/state-views';
import { ROUTES } from '@/lib/routes';

const LOGO_PX = 30;

/**
 * Shown when a screen cannot be drawn: most often its code did not download (no connection,
 * or a new version was published while the tab was open). Reloading fixes both.
 */
export function RouteError() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-7xl px-4 py-3 lg:px-8 lg:py-5">
        <HornillaLogo size={LOGO_PX} />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <ErrorState
          title="No pudimos abrir esta pantalla."
          description="Revisa tu conexión y vuelve a intentar. Si acabamos de actualizar Hornilla, recargar la trae al día."
          onRetry={() => window.location.reload()}
          secondaryAction={
            <ButtonLink to={ROUTES.home} variant="line" reloadDocument>
              Ir al inicio
            </ButtonLink>
          }
        />
      </main>
    </div>
  );
}
