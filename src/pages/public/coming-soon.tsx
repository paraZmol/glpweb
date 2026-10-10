import { Check, Hammer } from 'lucide-react';
import { BurnerRing } from '@/components/brand/burner-ring';
import { Highlight } from '@/components/brand/highlight';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { ButtonLink } from '@/components/common/button';
import { formatMoney } from '@/domain/money/format';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

const SAMPLE_PRICE_CENTS = 3800;
const PROMISES = ['Precio a la vista', 'Pagas al recibir', 'Sin instalar nada'];

/** Provisional home (`/`) until the search of nearby distributors is built (PLAN 2.6). */
export function ComingSoonPage() {
  usePageTitle('');
  return (
    <>
      <div className="mx-auto grid w-full max-w-7xl flex-1 content-center gap-14 px-4 pt-6 pb-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:px-8 lg:pb-20">
        <Headline />
        <PricePreview />
      </div>
      <OwnersBand />
    </>
  );
}

function Headline() {
  return (
    <section>
      <p className="inline-flex items-center gap-1.5 rounded-full bg-aji px-3 py-1 text-[0.8125rem] font-bold text-aji-foreground">
        <Hammer aria-hidden="true" className="size-4" strokeWidth={ICON_STROKE} />
        En construcción
      </p>
      <h1 className="mt-4 text-[2.625rem] font-extrabold lg:text-7xl">
        Pide tu gas y <Highlight>míralo llegar.</Highlight>
      </h1>
      <p className="mt-5 max-w-120 text-lg text-muted-foreground lg:text-xl">
        Hornilla reúne a las distribuidoras de gas de tu barrio: eliges la marca, ves el precio
        antes de pedir y sigues la moto en el mapa hasta tu puerta.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <ButtonLink to={ROUTES.register} variant="primary" size="lg">
          Crear mi cuenta
        </ButtonLink>
        <ButtonLink to={ROUTES.signIn} variant="line" size="lg">
          Ya tengo cuenta
        </ButtonLink>
      </div>
      <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem] font-semibold text-muted-foreground">
        {PROMISES.map((promise) => (
          <li key={promise} className="flex items-center gap-2">
            <Check
              aria-hidden="true"
              className="size-5 text-state-free-text"
              strokeWidth={ICON_STROKE}
            />
            {promise}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PricePreview() {
  return (
    <aside className="relative mx-auto w-full max-w-sm lg:max-w-md" aria-label="Ejemplo de precio">
      <BurnerRing
        thin
        className="-top-9 -right-7 size-36 lg:-top-14 lg:-right-14 lg:size-60 lg:[--burner-ring-width:14px]"
      />
      <div className="relative rounded-2xl bg-card p-6 shadow-float lg:p-8">
        <HornillaLogo variant="symbol" size={56} />
        <p className="mt-5 text-[0.9375rem] font-semibold text-muted-foreground">
          Balón de 10 kg desde
        </p>
        <p className="font-heading text-6xl font-extrabold tabular-nums">
          {formatMoney(SAMPLE_PRICE_CENTS)}
        </p>
        <p className="mt-4 rounded-lg bg-muted p-4 text-[0.9375rem] text-muted-foreground">
          Precio de ejemplo. Cada distribuidora publica los suyos y los ves antes de confirmar.
        </p>
      </div>
    </aside>
  );
}

function OwnersBand() {
  return (
    <section className="border-b border-band-foreground/15 bg-band text-band-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <h2 className="text-2xl font-extrabold">¿Tienes una distribuidora de gas?</h2>
        <p className="max-w-136 opacity-80 lg:text-lg">
          Pedidos, repartidores y caja en un solo mapa. Muy pronto vas a poder sumarla a Hornilla.
        </p>
      </div>
    </section>
  );
}
