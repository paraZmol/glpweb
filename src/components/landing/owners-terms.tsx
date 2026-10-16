import { Eye, Lock, Wallet, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ICON_STROKE } from '@/lib/icons';
import { TRIAL_NOTE } from './owners-hero';

type CardProps = { id: string; icon: LucideIcon; title: string; children: ReactNode };

function Card({ id, icon: Icon, title, children }: CardProps) {
  return (
    <section aria-labelledby={id} className="rounded-2xl bg-card p-6 shadow-card lg:p-8">
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE} className="size-8 text-flame-text" />
      <h2 id={id} className="mt-3 text-2xl font-extrabold lg:text-3xl">
        {title}
      </h2>
      <div className="mt-2 text-lg text-muted-foreground">{children}</div>
    </section>
  );
}

/** What Hornilla asks for, what becomes public, and the price as far as it is decided. */
export function OwnersTerms() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <Card id="te-pedimos" icon={Lock} title="Lo que te pedimos">
        <p>RUC, razón social y registro de Osinergmin. No se muestran al público.</p>
      </Card>
      <Card id="es-publico" icon={Eye} title="Qué sí es público">
        <p>Nombre, teléfono, WhatsApp, dirección, zona, horario y precios.</p>
      </Card>
      <Card id="precio" icon={Wallet} title="Precio">
        <p>
          <strong className="text-foreground">{TRIAL_NOTE}</strong> El precio del plan se informa
          antes de contratarlo; sin plan no se cobra nada.
        </p>
      </Card>
    </div>
  );
}
