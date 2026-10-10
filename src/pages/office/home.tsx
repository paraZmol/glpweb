import { ButtonLink } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { EmptyState } from '@/components/common/state-views';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { ROLE_LABELS } from '@/components/layout/role-labels';
import type { Distributor } from '@/domain/tenancy/types';
import { useAccount } from '@/features/account/account-context';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { PlanChip } from './plan-chip';

const PUBLIC_LINK_PREFIX = '/d/';

function DistributorFacts({ distributor, role }: { distributor: Distributor; role: string }) {
  const facts = [
    ['Tu rol', role],
    ['Enlace público', `${PUBLIC_LINK_PREFIX}${distributor.slug}`],
    ['Cobertura', `${distributor.coverageRadiusKm} km desde la planta`],
    ['Máximo por pedido', `${distributor.maxCylindersPerOrder} balones`],
  ];
  return (
    <Panel dense>
      <h2 className="text-lg font-bold">Tu distribuidora</h2>
      <dl className="mt-3 flex flex-col divide-y">
        {facts.map(([term, value]) => (
          <div key={term} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="min-w-0 truncate font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function OfficeHomeSkeleton() {
  return (
    <LoadingRegion label="Cargando tu distribuidora" className="flex flex-col gap-6">
      <Bone className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Bone className="h-60 rounded-lg" />
        <Bone className="h-60 rounded-lg" />
      </div>
    </LoadingRegion>
  );
}

/**
 * Home of the office (owner and dispatcher). The live monitor arrives with phase 6; for now it
 * shows where the distributor stands and that no order has come in, in the dense office ambient.
 */
export function OfficeHomePage() {
  usePageTitle('Monitor');
  const { current } = useAccount();
  if (current.status !== 'ready') return <OfficeHomeSkeleton />;
  const { distributor, membership, isWritable } = current;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title={`Hoy en ${distributor.name}.`}
        lead="Pedidos, repartidores y stock de tu distribuidora, en un solo lugar."
        aside={<PlanChip distributor={distributor} />}
      />
      {!isWritable && (
        <InlineAlert tone="info">
          Tu distribuidora está en solo lectura: puedes ver todo, pero no registrar cambios hasta
          regularizar el plan.
        </InlineAlert>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel dense>
          <EmptyState
            title="Todavía no entra ningún pedido."
            description="Tu distribuidora ya está registrada. Lo que sigue es cargar tu catálogo y sumar a tu personal: cuando estén, los pedidos de hoy se van a ver aquí."
            action={
              <ButtonLink to={ROUTES.account} variant="ink" size="sm">
                Revisar mi cuenta
              </ButtonLink>
            }
          />
        </Panel>
        <DistributorFacts distributor={distributor} role={ROLE_LABELS[membership.role]} />
      </div>
    </div>
  );
}
