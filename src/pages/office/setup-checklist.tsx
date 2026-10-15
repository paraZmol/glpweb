import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/common/button';
import { Panel } from '@/components/layout/page-header';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { ICON_STROKE } from '@/lib/icons';
import { distributorPath, ROUTES } from '@/lib/routes';
import { Task } from './setup-task';

/**
 * PLAN 3.1: done once a product is on sale. The profile already says so without reading the
 * catalogue: its "desde" price is the cheapest refill on sale, and every product has a refill.
 */
function CatalogTask({
  hasProductsOnSale,
  canEdit,
}: {
  hasProductsOnSale: boolean;
  canEdit: boolean;
}) {
  return (
    <Task
      title="Carga tu catálogo"
      detail={
        hasProductsOnSale
          ? 'Ya tienes balones a la venta. Cambia precios y orden cuando quieras.'
          : 'Balones, marcas y precios: tus clientes los ven en tu página.'
      }
      isDone={hasProductsOnSale}
      action={
        <ButtonLink
          to={ROUTES.officeCatalog}
          variant={hasProductsOnSale || !canEdit ? 'line' : 'soft'}
          size="sm"
          className="shrink-0"
        >
          {hasProductsOnSale || !canEdit ? 'Ver catálogo' : 'Cargar catálogo'}
        </ButtonLink>
      }
    />
  );
}

type SetupChecklistProps = {
  distributor: PublicDistributor;
  /** Whether visitors can open its page already (PLAN 2.11). */
  isListed: boolean;
  /** False on a read-only distributor: its profile can be looked at, not changed. */
  canEdit?: boolean;
};

/**
 * "Completa tu distribuidora" (PLAN 2.2): what the owner has done and what comes next. The
 * catalogue is real since PLAN 3.1 and the staff since PLAN 3.2.
 */
export function SetupChecklist(props: SetupChecklistProps) {
  const { distributor, isListed, canEdit = true } = props;
  return (
    <Panel dense>
      <h2 className="text-lg font-bold">Completa tu distribuidora</h2>
      <ul className="mt-1 flex flex-col divide-y">
        <Task
          title="Datos, enlace y color"
          detail={
            canEdit
              ? 'Lo que escribiste al registrarla. Puedes cambiarlo, salvo el enlace.'
              : 'Lo que escribiste al registrarla. En solo lectura no se puede cambiar.'
          }
          isDone
          action={
            <ButtonLink to={ROUTES.officeProfile} variant="line" size="sm" className="shrink-0">
              {canEdit ? 'Editar ficha' : 'Ver ficha'}
            </ButtonLink>
          }
        />
        <Task
          title="Mira tu página pública"
          detail={
            isListed
              ? 'Así la ven tus clientes. Comparte el enlace.'
              : 'Ahora solo la ve tu personal: no es pública.'
          }
          action={
            <ButtonLink
              to={distributorPath(distributor.slug)}
              variant="soft"
              size="sm"
              className="shrink-0"
            >
              Ver mi página
              <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
            </ButtonLink>
          }
        />
        <CatalogTask hasProductsOnSale={distributor.priceFromCents !== null} canEdit={canEdit} />
        <Task
          title="Suma a tu personal"
          detail={
            canEdit
              ? 'Central y repartidores, con un enlace que les envías por WhatsApp.'
              : 'Mira quién trabaja contigo. En solo lectura no se puede invitar.'
          }
          action={
            <ButtonLink
              to={ROUTES.officeStaff}
              variant={canEdit ? 'soft' : 'line'}
              size="sm"
              className="shrink-0"
            >
              {canEdit ? 'Invitar' : 'Ver personal'}
            </ButtonLink>
          }
        />
      </ul>
    </Panel>
  );
}
