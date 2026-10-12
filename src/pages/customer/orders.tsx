import { GasCylinder } from '@/components/brand/gas-cylinder';
import { ButtonLink } from '@/components/common/button';
import { EmptyState } from '@/components/common/state-views';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

const EMPTY_CYLINDER_PX = 72;

/** Order history of the customer. Orders arrive with phase 4: until then the list is empty. */
export function CustomerOrdersPage() {
  usePageTitle('Tus pedidos');
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Tus pedidos."
        lead="Aquí vas a seguir el que viene en camino y repetir el de siempre."
      />
      <Panel className="lg:max-w-2xl">
        <EmptyState
          symbol={<GasCylinder weightKg={15} tone="mono" height={EMPTY_CYLINDER_PX} />}
          title="Todavía no tienes pedidos."
          description="Cuando hagas el primero, aparece aquí con su estado y su total."
          action={
            <ButtonLink to={ROUTES.customerHome} variant="ink">
              Ir al inicio
            </ButtonLink>
          }
        />
      </Panel>
    </div>
  );
}
