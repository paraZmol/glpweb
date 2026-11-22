import { ArrowRight } from 'lucide-react';
import { BurnerRing } from '@/components/brand/burner-ring';
import { ButtonLink } from '@/components/common/button';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';
import { Link } from 'react-router';

/**
 * Band for owners (PLAN 2.2, 2.6, 3.6): right after the finder, it leads to
 * `/para-distribuidoras` and, for whoever already decided, to the sign-up of a distributor.
 * It promises only what the sign-up gives today.
 * `to`: the sign-up itself for a signed-in account; for a visitor, `/registro` on the way to it,
 * because an owner who arrives here most likely has no account yet (PLAN §11, 2026-10-14).
 */
export function OwnersBand({ to }: { to: string }) {
  return (
    <section
      aria-labelledby="para-distribuidoras"
      className="relative overflow-hidden rounded-2xl bg-band p-6 text-band-foreground lg:flex lg:items-center lg:justify-between lg:gap-10 lg:p-12"
    >
      <BurnerRing className="-top-36 -right-28 hidden size-64 lg:block" />
      <div className="relative">
        <h2 id="para-distribuidoras" className="text-[1.75rem] font-extrabold lg:text-4xl">
          ¿Tienes una distribuidora de gas?
        </h2>
        <p className="mt-2 max-w-136 text-band-foreground/80 lg:text-lg">
          Muestra tus marcas, precios y zona de reparto a la gente de tu zona. Registra tu
          distribuidora en minutos; aparece en el buscador cuando revisamos sus datos. Los primeros
          30 días son de prueba, gratis y sin tarjeta.
        </p>
      </div>
      <div className="relative mt-5 flex shrink-0 flex-col items-center gap-2 lg:mt-0">
        <ButtonLink
          to={ROUTES.forDistributors}
          variant="primary"
          size="lg"
          className="w-full lg:w-auto"
        >
          Conoce cómo funciona
          <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
        </ButtonLink>
        <Link
          to={to}
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          Registrar mi distribuidora
        </Link>
      </div>
    </section>
  );
}
