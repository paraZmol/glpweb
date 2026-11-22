import { ArrowRight } from 'lucide-react';
import { BurnerRing } from '@/components/brand/burner-ring';
import { Highlight } from '@/components/brand/highlight';
import { ButtonLink } from '@/components/common/button';
import { ICON_STROKE } from '@/lib/icons';
import { DESK_PHOTO } from '@/lib/photos';

export const TRIAL_NOTE = '30 días de prueba, gratis y sin tarjeta.';

/** Opening of `/para-distribuidoras`: the promise for the owner and the one action. */
export function OwnersHero({ registerTo }: { registerTo: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14">
      <header>
        <h1 className="text-[2.625rem] font-extrabold text-balance lg:text-7xl">
          Que la gente de tu zona <Highlight>te encuentre.</Highlight>
        </h1>
        <p className="mt-4 max-w-120 text-lg text-pretty text-muted-foreground lg:mt-5 lg:text-xl">
          Publica tus marcas, precios y zona de reparto en Hornilla. Te llaman o te escriben directo
          a ti.
        </p>
        <ButtonLink to={registerTo} variant="primary" size="lg" className="mt-6 w-full sm:w-auto">
          Registrar mi distribuidora
          <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
        </ButtonLink>
        <p className="mt-3 text-sm font-semibold text-muted-foreground">{TRIAL_NOTE}</p>
      </header>
      <div className="relative">
        <BurnerRing className="-right-10 -bottom-10 hidden size-56 lg:block" />
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted lg:rounded-3xl lg:shadow-float">
          <img
            {...DESK_PHOTO}
            sizes="(min-width: 1024px) 560px, calc(100vw - 2rem)"
            alt="Persona atendiendo el teléfono en su escritorio, junto a una laptop"
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover brightness-(--photo-brightness)"
          />
        </div>
      </div>
    </div>
  );
}
