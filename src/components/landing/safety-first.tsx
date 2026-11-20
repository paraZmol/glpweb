import { ShieldCheck } from 'lucide-react';
import { ICON_STROKE } from '@/lib/icons';
import { VALVES_PHOTO } from '@/lib/photos';

/**
 * "Tu seguridad primero" (docs/marketing/portada.md §6). Advice only: Hornilla does not
 * certify cylinders nor distributors, and the text must not suggest it.
 */
export function SafetyFirst() {
  return (
    <section
      aria-labelledby="seguridad"
      className="grid overflow-hidden rounded-2xl bg-flame-soft lg:grid-cols-[1fr_1.1fr]"
    >
      <div className="relative aspect-video lg:aspect-auto lg:min-h-80">
        <img
          {...VALVES_PHOTO}
          sizes="(min-width: 1024px) 580px, calc(100vw - 2rem)"
          alt="Balones de gas vistos desde arriba, con sus asas y válvulas"
          loading="lazy"
          className="absolute inset-0 size-full object-cover brightness-(--photo-brightness)"
        />
      </div>
      <div className="p-6 lg:p-12">
        <ShieldCheck
          aria-hidden="true"
          strokeWidth={ICON_STROKE}
          className="size-9 text-flame-text"
        />
        <h2 id="seguridad" className="mt-3 text-[1.75rem] font-extrabold lg:text-4xl">
          Tu seguridad primero
        </h2>
        <p className="mt-3 text-lg text-pretty">
          Compra a distribuidoras formales. Al recibir, revisa que el balón tenga su precinto de
          seguridad intacto y que no huela a gas; si huele, no lo aceptes, ventila y no prendas
          fuego ni interruptores. Nunca trasvases gas entre balones.
        </p>
      </div>
    </section>
  );
}
