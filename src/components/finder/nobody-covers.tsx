import { MessageCircle } from 'lucide-react';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { EmptyState } from '@/components/common/state-views';
import { buttonClassName } from '@/components/common/button';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';

const SYMBOL_PX = 64;
const SHARE_BASE = 'https://wa.me/?text=';

/** The message a neighbour sends to the distributor they already buy from. */
function inviteHref(): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const message = `Hola. Me gustaría pedirles el gas por Hornilla. Pueden sumar su distribuidora aquí: ${origin}${ROUTES.newDistributor}`;
  return `${SHARE_BASE}${encodeURIComponent(message)}`;
}

/**
 * Empty result of the search (PLAN 2.6): nobody delivers to that point yet. The way out is to
 * tell the distributor the person already knows; the link opens WhatsApp with the message
 * written and the person picks the contact. Hornilla sends nothing by itself.
 */
export function NobodyCovers() {
  return (
    <EmptyState
      className="rounded-xl bg-card p-6 shadow-card"
      symbol={<GasCylinder weightKg={10} tone="mono" height={SYMBOL_PX} />}
      title="Todavía no hay distribuidoras en tu zona."
      description="Hornilla recién empieza y se va llenando barrio por barrio. Si ya le compras a una distribuidora, avísale: sumarse le toma una tarde y es gratis por 30 días."
      action={
        <a
          href={inviteHref()}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({ variant: 'ink' })}
        >
          <MessageCircle aria-hidden="true" strokeWidth={ICON_STROKE} />
          Avisarle por WhatsApp
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      }
    />
  );
}
