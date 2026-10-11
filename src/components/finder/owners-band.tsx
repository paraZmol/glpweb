import { ArrowRight } from 'lucide-react';
import { BurnerRing } from '@/components/brand/burner-ring';
import { ButtonLink } from '@/components/common/button';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';

/**
 * Closing band for owners (PLAN 2.2, 2.6): the way from the finder to the sign-up of a
 * distributor. It promises only what the sign-up gives today.
 */
export function OwnersBand() {
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
          Regístrala y prepara tu página en Hornilla, con tu color y tu enlace. Aparece en el
          buscador cuando revisamos sus datos. Los primeros 30 días son de prueba, gratis y sin
          tarjeta.
        </p>
      </div>
      <ButtonLink
        to={ROUTES.newDistributor}
        variant="primary"
        size="lg"
        className="relative mt-5 w-full lg:mt-0 lg:w-auto"
      >
        Súmala a Hornilla
        <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
      </ButtonLink>
    </section>
  );
}
