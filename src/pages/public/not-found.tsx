import { BurnerRing } from '@/components/brand/burner-ring';
import { Highlight } from '@/components/brand/highlight';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { ButtonLink } from '@/components/common/button';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

const SYMBOL_PX = 72;

/** Any address the app does not know. Says so and offers the two usual ways on. */
export function NotFoundPage() {
  usePageTitle('Página no encontrada');
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 content-center gap-12 px-4 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-8 lg:py-24">
      <section>
        <p className="font-heading text-lg font-bold text-muted-foreground tabular-nums">
          Error 404
        </p>
        <h1 className="mt-2 text-[2.625rem] font-extrabold lg:text-7xl">
          Esta página <Highlight>no existe.</Highlight>
        </h1>
        <p className="mt-5 max-w-120 text-lg text-muted-foreground lg:text-xl">
          Puede que el enlace esté mal escrito o que la página haya cambiado de lugar. Tu gas sigue
          donde siempre.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to={ROUTES.home} variant="primary" size="lg">
            Ir al inicio
          </ButtonLink>
          <ButtonLink to={ROUTES.signIn} variant="line" size="lg">
            Ingresar
          </ButtonLink>
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
