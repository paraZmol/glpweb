import { EyeOff, HandCoins, Tag } from 'lucide-react';
import { Stagger } from '@/components/motion/stagger';
import { ICON_STROKE } from '@/lib/icons';

const POINTS = [
  {
    icon: Tag,
    title: 'Precios a la vista',
    text: 'Cada distribuidora publica el precio final de su balón.',
  },
  {
    icon: HandCoins,
    title: 'Tú eliges',
    text: 'La marca y la distribuidora que prefieras, sin intermediarios en el pago.',
  },
  {
    icon: EyeOff,
    title: 'Sin rastreo',
    text: 'No usamos publicidad ni analítica que te siga.',
  },
];

/** "Qué es Hornilla" (docs/marketing/portada.md §3): who sells the gas, said plainly. */
export function WhatIsHornilla() {
  return (
    <section aria-labelledby="que-es-hornilla">
      <h2 id="que-es-hornilla" className="text-[2.125rem] font-extrabold lg:text-[3.25rem]">
        Qué es Hornilla
      </h2>
      <p className="mt-3 max-w-3xl text-lg text-pretty text-muted-foreground lg:text-xl">
        Hornilla es una vitrina donde las distribuidoras de gas de tu zona muestran sus marcas,
        precios, horario y hasta dónde reparten. Tú eliges a quién comprarle. El gas, el precio y la
        entrega son de cada distribuidora: Hornilla no vende gas ni lo reparte.
      </p>
      <Stagger as="ul" inView className="mt-6 grid gap-3 lg:mt-10 lg:grid-cols-3 lg:gap-6">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex h-full gap-4 rounded-xl bg-muted p-4 lg:flex-col lg:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-flame-soft">
              <Icon aria-hidden="true" strokeWidth={ICON_STROKE} className="text-flame-text" />
            </span>
            <div>
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="mt-1 text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </Stagger>
    </section>
  );
}
