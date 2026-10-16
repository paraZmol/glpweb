import { ArrowRight, Plus } from 'lucide-react';
import { Button, ButtonLink } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextLink } from '@/components/common/text-link';
import { PageHeader } from '@/components/layout/page-header';
import { MAX_PRODUCTS } from '@/domain/catalog/constants';
import { CatalogFullError } from '@/domain/catalog/errors';
import type { Distributor } from '@/domain/tenancy/types';
import { describeCatalogError } from '@/features/catalog/catalog-messages';
import { ICON_STROKE } from '@/lib/icons';
import { distributorPath, ROUTES } from '@/lib/routes';
import { isSuspended, SuspendedNotice } from './read-only-notice';

export const STAFF_READS =
  'Los productos y los precios los cambian el titular y la central. Aquí los ves tal como están, también los que no están a la venta.';
const PLAN_READ_ONLY =
  'Tu distribuidora está en solo lectura: puedes ver tu catálogo, pero no cambiarlo hasta regularizar el plan.';

export function AddProductButton({
  onAdd,
  isFirst = false,
}: {
  onAdd: () => void;
  isFirst?: boolean;
}) {
  return (
    <Button type="button" onClick={onAdd} className="max-sm:w-full">
      <Plus aria-hidden="true" strokeWidth={ICON_STROKE} />
      {isFirst ? 'Añadir tu primer producto' : 'Añadir producto'}
    </Button>
  );
}

/** Every slot is in use (withdrawn products keep theirs): said where the button was. */
export function CatalogFullNotice() {
  return (
    <InlineAlert tone="info" className="lg:max-w-md">
      {describeCatalogError(new CatalogFullError(MAX_PRODUCTS))} Si te hace falta otro, escríbenos
      desde{' '}
      <TextLink to={ROUTES.contact} className="text-current">
        Contacto y reclamos
      </TextLink>
      .
    </InlineAlert>
  );
}

type CatalogHeaderProps = {
  distributor: Distributor;
  /** The account sets products and prices (owner or dispatcher, `canEditCatalog`). */
  managesCatalog: boolean;
  isWritable: boolean;
  /** How many products there are, once known. */
  total: number | null;
  /** The form is open: there is nothing to add from here. */
  isEditing: boolean;
  onAdd: () => void;
};

/** Title, what this screen is, who may change it and the one main action (PLAN 3.1). */
export function CatalogHeader(props: CatalogHeaderProps) {
  const { distributor, managesCatalog, isWritable, total, isEditing, onAdd } = props;
  const canAdd = managesCatalog && isWritable && !isEditing && total !== null && total > 0;
  const isFull = total !== null && total >= MAX_PRODUCTS;

  const aside = canAdd ? (
    <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap lg:justify-end">
      <ButtonLink to={distributorPath(distributor.slug)} variant="line" className="max-sm:hidden">
        Ver mi página
        <ArrowRight aria-hidden="true" strokeWidth={ICON_STROKE} />
      </ButtonLink>
      {isFull ? <CatalogFullNotice /> : <AddProductButton onAdd={onAdd} />}
    </div>
  ) : undefined;

  return (
    <>
      <PageHeader
        dense
        title={managesCatalog ? 'Tu catálogo.' : 'Catálogo y precios.'}
        lead={
          managesCatalog
            ? 'Los balones que vendes, con su marca y sus precios. Tus clientes los ven en tu página en este mismo orden.'
            : `Los balones de ${distributor.name}, con el precio de la recarga y del balón completo.`
        }
        aside={aside}
      />
      {!isWritable && (
        <InlineAlert tone="info">
          {isSuspended(distributor.status) ? <SuspendedNotice /> : PLAN_READ_ONLY}
        </InlineAlert>
      )}
      {!managesCatalog && <InlineAlert tone="info">{STAFF_READS}</InlineAlert>}
    </>
  );
}
