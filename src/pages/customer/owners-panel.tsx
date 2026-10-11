import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/common/button';
import { Panel } from '@/components/layout/page-header';
import type { FoundingAvailability } from '@/features/tenancy/founding-availability';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';
import { FOUNDING_STOP_COPY } from './founding-stops';

/**
 * The way from the account to the sign-up of a distributor (PLAN 2.2). An account that reached
 * the cap, or that founded a distributor that is read-only, is told why instead of being
 * offered a sign-up that would be refused (PLAN 2.11).
 */
export function OwnersPanel({ availability }: { availability: FoundingAvailability }) {
  if (availability !== 'available') {
    const { title, description } = FOUNDING_STOP_COPY[availability];
    return (
      <Panel>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1.5 text-muted-foreground">{description}</p>
      </Panel>
    );
  }
  return (
    <Panel>
      <h2 className="text-xl font-bold">¿Tienes una distribuidora de gas?</h2>
      <p className="mt-1.5 text-muted-foreground">
        Regístrala con esta misma cuenta: tu página, tu color y tu enlace. Aparece en el buscador
        cuando Hornilla revisa sus datos. Los primeros 30 días son de prueba, gratis y sin tarjeta.
      </p>
      <ButtonLink to={ROUTES.newDistributor} variant="soft" className="mt-5">
        Registrar mi distribuidora
        <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
      </ButtonLink>
    </Panel>
  );
}
