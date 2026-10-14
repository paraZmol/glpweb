import { Check, Hammer } from 'lucide-react';
import type { ReactNode } from 'react';
import kettlePhoto from '../../../docs/design/images/pexels-13772359-tetera-llama-cocina.jpg';
import { BurnerRing } from '@/components/brand/burner-ring';
import { GLYPH_STROKE } from '@/lib/icons';
import { useIsDesktop } from '@/lib/use-media-query';

// Only what already works (PLAN 2.9); what is still being built is said as such, like the
// "En construcción" stamp of the home.
const PROMISES = ['Distribuidoras de tu zona', 'Sin instalar nada', 'Sin publicidad ni rastreo'];
const COMING_NEXT = 'Pronto: pedir y ver llegar tu gas';

/** Desktop only: the kitchen photo with the burner ring and a floating card. The photo stays clean. */
function AuthAside() {
  return (
    <aside
      className="sticky top-[calc(var(--top-inset)+1.5rem)] ml-auto w-full max-w-136 self-start"
      aria-label="Lo que ofrece Hornilla"
    >
      <BurnerRing className="-right-12 -bottom-10 size-56" />
      <div className="relative aspect-4/5 max-h-[calc(100dvh-14rem)] w-full overflow-hidden rounded-3xl bg-muted shadow-float">
        <img
          src={kettlePhoto}
          alt="Tetera sobre una hornilla encendida con llama azul"
          className="absolute inset-0 size-full object-cover object-[64%_50%] brightness-(--photo-brightness)"
        />
      </div>
      <ul className="absolute bottom-10 -left-10 flex flex-col gap-2.5 rounded-xl bg-card p-5 text-[0.9375rem] font-semibold shadow-float">
        {PROMISES.map((promise) => (
          <li key={promise} className="flex items-center gap-2.5">
            <Check
              aria-hidden="true"
              className="size-4 text-state-free-text"
              strokeWidth={GLYPH_STROKE}
            />
            {promise}
          </li>
        ))}
        <li className="mt-1 flex items-center gap-2.5 border-t pt-3 text-muted-foreground">
          <Hammer aria-hidden="true" className="size-4" strokeWidth={GLYPH_STROKE} />
          {COMING_NEXT}
        </li>
      </ul>
    </aside>
  );
}

type AuthFrameProps = {
  /** The `h1`: a full sentence ending in a full stop. */
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  /** Secondary way out under the form ("No acepto: eliminar mi cuenta"). */
  footer?: ReactNode;
};

/**
 * Layout of the account screens (DIRECCION.md, "Acceso y registro"). Phone: one column, the
 * form straight on the page. Desktop: the form in a raised card on the left and the photo of
 * the kitchen on the right; it is its own composition, not the phone stretched.
 */
export function AuthFrame({ title, lead, children, footer }: AuthFrameProps) {
  const isDesktop = useIsDesktop();
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-12 px-4 pt-6 pb-14 lg:grid-cols-[minmax(0,31rem)_1fr] lg:items-center lg:gap-24 lg:px-8 lg:pt-4 lg:pb-20">
      <section className="mx-auto w-full max-w-md lg:max-w-none lg:rounded-2xl lg:bg-card lg:p-10 lg:shadow-raised">
        <h1 className="text-[2.125rem] font-extrabold text-balance lg:text-[2.5rem]">{title}</h1>
        {lead && <p className="mt-3 text-lg text-pretty text-muted-foreground">{lead}</p>}
        <div className="mt-7">{children}</div>
        {footer && <div className="mt-7 border-t pt-5 text-[0.9375rem]">{footer}</div>}
      </section>
      {isDesktop && <AuthAside />}
    </div>
  );
}
