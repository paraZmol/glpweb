import { BurnerRing } from '@/components/brand/burner-ring';
import { SoonStamp } from '@/components/landing/soon-stamp';
import { StepsTimeline } from '@/components/landing/steps-timeline';
import { PHONE_PHOTO } from '@/lib/photos';

// What ordering will be like once phases 4 and 6 exist. Written in the future on purpose: the
// app must not promise today what it cannot do yet (PLAN 2.9).
const STEPS = [
  {
    title: 'Elegirás tu distribuidora y tu marca',
    text: 'Con el precio del balón a la vista, antes de pedir.',
  },
  {
    title: 'Confirmarás dónde lo dejan',
    text: 'Marcarás tu puerta en el mapa y agregarás una referencia.',
  },
  {
    title: 'Verás venir el reparto',
    text: 'Y pagarás al recibir, directo a la distribuidora.',
  },
];

/** "Así va a funcionar": the three steps of an order, announced as what is being built. */
export function ComingNext() {
  return (
    <section
      aria-labelledby="lo-que-viene"
      className="grid gap-8 lg:grid-cols-[27.5rem_1fr] lg:items-center lg:gap-16"
    >
      <div className="relative mx-auto w-full max-w-105 lg:mx-0">
        <BurnerRing thin tone="flame" className="-top-5 -left-5 size-32 lg:-top-8 lg:-left-8" />
        <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-muted">
          <img
            {...PHONE_PHOTO}
            sizes="(min-width: 1024px) 440px, min(calc(100vw - 2rem), 420px)"
            alt="Persona sonriendo mientras usa su celular en casa"
            loading="lazy"
            className="absolute inset-0 size-full object-cover object-[68%_30%] brightness-(--photo-brightness)"
          />
        </div>
      </div>
      <div>
        <SoonStamp />
        <h2 id="lo-que-viene" className="mt-4 text-[2.125rem] font-extrabold lg:text-[3.25rem]">
          Así va a funcionar.
        </h2>
        <p className="mt-3 max-w-prose text-lg text-muted-foreground">
          Hoy ya puedes ver qué distribuidoras llegan a tu puerta y llamarlas o escribirles. Pedir
          desde Hornilla es lo que sigue.
        </p>
        <StepsTimeline steps={STEPS} layout="column" className="mt-6" />
      </div>
    </section>
  );
}
