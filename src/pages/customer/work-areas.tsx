import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/common/button';
import { Panel } from '@/components/layout/page-header';
import { type NavAccount, workAreasOf } from '@/components/layout/nav-items';
import type { AppArea } from '@/domain/auth/access';
import { ICON_STROKE } from '@/lib/icons';
import { AREA_HOME } from '@/lib/routes';

const AREA_COPY: Record<Exclude<AppArea, 'customer'>, { name: string; about: string }> = {
  office: { name: 'Central', about: 'Pedidos, repartidores y el día de tu distribuidora.' },
  driver: { name: 'Reparto', about: 'Tu jornada, tus pedidos y el cobro en la entrega.' },
  platform: { name: 'Plataforma', about: 'Las distribuidoras de Hornilla y su estado.' },
};

/**
 * Ways into the work areas of the account. Render it only when `workAreasOf` is not empty.
 * These are shortcuts: the guard of each area decides again who may open it.
 */
export function WorkAreas(account: NavAccount) {
  const areas = workAreasOf(account);

  return (
    <Panel>
      <h2 className="text-xl font-bold">Tus espacios de trabajo</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {areas.map((area) => (
          <li key={area} className="flex items-center justify-between gap-4">
            <p className="min-w-0 text-[0.9375rem] text-muted-foreground">
              <strong className="block font-heading text-base text-foreground">
                {AREA_COPY[area].name}
              </strong>
              {AREA_COPY[area].about}
            </p>
            <ButtonLink to={AREA_HOME[area]} variant="soft" size="sm" className="shrink-0">
              Abrir
              <span className="sr-only"> {AREA_COPY[area].name}</span>
              <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
            </ButtonLink>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
