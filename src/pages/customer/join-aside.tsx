import { ShieldCheck, Store, UserRound } from 'lucide-react';
import { ICON_STROKE } from '@/lib/icons';

// What joining means, said before the button (PLAN 3.2). Reviewed text: `legal-compliance` looks
// at what the distributor gets to see of the person.
const POINTS = [
  {
    icon: Store,
    title: 'Trabajas en su panel',
    text: 'Entras al panel de la distribuidora con el rol de la invitación. Lo que hagas ahí queda a tu nombre.',
  },
  {
    icon: UserRound,
    title: 'Su personal ve tu nombre',
    text: 'El nombre de tu perfil aparece en su lista de personal. Tu celular y tu correo no.',
  },
  {
    icon: ShieldCheck,
    title: 'Tu cuenta sigue siendo tuya',
    text: 'Puedes seguir pidiendo gas como cliente. Si su titular te desactiva, dejas de entrar a su panel y nada más.',
  },
] as const;

/** Beside the invitation on a desktop, under it on a phone. */
export function JoinAside() {
  return (
    <aside aria-labelledby="join-aside-title" className="rounded-xl bg-surface-soft p-6 lg:mt-2">
      <h2 id="join-aside-title" className="text-xl font-bold">
        Qué pasa al unirte.
      </h2>
      <ul className="mt-4 flex flex-col gap-4">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-flame-text"
              strokeWidth={ICON_STROKE}
            />
            <p className="text-muted-foreground">
              <strong className="block text-foreground">{title}</strong>
              {text}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
