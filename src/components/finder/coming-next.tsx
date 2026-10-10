import { Hammer } from 'lucide-react';
import phonePhoto from '../../../docs/design/images/pexels-4747813-mujer-celular-lima.jpg';
import { BurnerRing } from '@/components/brand/burner-ring';
import { Stagger } from '@/components/motion/stagger';
import { ICON_STROKE } from '@/lib/icons';

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
    title: 'Verás venir la moto',
    text: 'Seguirás al repartidor y pagarás al recibir, directo a la distribuidora.',
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
            src={phonePhoto}
            alt="Persona sonriendo mientras usa su celular en casa"
            loading="lazy"
            className="absolute inset-0 size-full object-cover object-[68%_30%] brightness-(--photo-brightness)"
          />
        </div>
      </div>
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-aji px-3 py-1 text-[0.8125rem] font-bold text-aji-foreground">
          <Hammer aria-hidden="true" className="size-4" strokeWidth={ICON_STROKE} />
          En construcción
        </p>
        <h2 id="lo-que-viene" className="mt-4 text-[2.125rem] font-extrabold lg:text-[3.25rem]">
          Así va a funcionar.
        </h2>
        <p className="mt-3 max-w-prose text-lg text-muted-foreground">
          Hoy ya puedes ver qué distribuidoras llegan a tu puerta y llamarlas o escribirles. Pedir
          desde Hornilla es lo que sigue.
        </p>
        <Stagger as="ol" className="mt-6 grid gap-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="flex items-start gap-4 rounded-xl bg-muted p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft font-heading text-xl font-extrabold text-primary-text tabular-nums">
                {index + 1}
              </span>
              <div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="mt-1 text-muted-foreground">{step.text}</p>
              </div>
            </div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
