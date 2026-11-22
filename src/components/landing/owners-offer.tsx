import { Check } from 'lucide-react';
import { Stagger } from '@/components/motion/stagger';
import { GLYPH_STROKE } from '@/lib/icons';
import { SoonStamp } from './soon-stamp';

const TODAY = [
  'Página propia con tu color y tu enlace',
  'Catálogo con recarga y balón completo',
  'Tu personal: central y repartidores',
];

const NEXT = [
  'Promociones con vigencia y límite',
  'Tus vehículos',
  'Stock de planta',
  'Pedidos por la web y por teléfono en un solo lugar',
  'Jornada y cuadre de caja del repartidor',
  'Mapa con tus repartidores en vivo',
  'Avisos en el celular',
];

const COLUMN = 'rounded-2xl p-6 lg:p-8';
const TITLE = 'text-[1.75rem] font-extrabold lg:text-4xl';

/** What works today and what is announced, side by side on desktop; never mixed. */
export function OwnersOffer() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
      <section aria-labelledby="ya-puedes" className={`${COLUMN} bg-card shadow-card`}>
        <h2 id="ya-puedes" className={TITLE}>
          Lo que ya puedes hacer
        </h2>
        <Stagger as="ul" inView className="mt-5 grid gap-3">
          {TODAY.map((item) => (
            <span key={item} className="flex items-start gap-3 text-lg">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-state-free text-state-free-foreground">
                <Check aria-hidden="true" className="size-4" strokeWidth={GLYPH_STROKE} />
              </span>
              {item}
            </span>
          ))}
        </Stagger>
      </section>
      <section aria-labelledby="lo-que-viene-duenos" className={`${COLUMN} bg-muted`}>
        <h2 id="lo-que-viene-duenos" className={TITLE}>
          Lo que viene
        </h2>
        <ul className="mt-5 grid gap-3">
          {NEXT.map((item) => (
            <li key={item} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg">
              <span>{item}</span>
              <SoonStamp className="py-0.5" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
