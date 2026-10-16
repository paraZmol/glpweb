import { ShieldCheck } from 'lucide-react';
import valvesPhoto from '../../../docs/design/images/unsplash-zENzDOsA2XA-balones-detalle-valvulas.jpg';
import { ICON_STROKE } from '@/lib/icons';

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
          src={valvesPhoto}
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
          Compra a distribuidoras formales. Al recibir, revisa que el balón tenga su precinto y no
          huela a gas. Nunca trasvases gas entre balones.
        </p>
      </div>
    </section>
  );
}
