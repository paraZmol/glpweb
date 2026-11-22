import { describe, expect, it } from 'vitest';
import {
  accountOf,
  distributorOf,
  memberOf,
  workingAs,
} from '../../../tests/support/account-fixtures';
import { renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { AppShell } from '../../components/layout/app-shell';
import type { Distributor } from '../../domain/tenancy/types';
import { ROUTES } from '../../lib/routes';
import { DriverCatalogPage } from '../driver/catalog';
import { CatalogPage } from './catalog';
import { CatalogHeader, STAFF_READS } from './catalog-header';
import { SetupChecklist } from './setup-checklist';

const DISTRIBUTOR = distributorOf('d-norte');

type HeaderCase = { managesCatalog?: boolean; isWritable?: boolean; total?: number | null };

function header({ managesCatalog = true, isWritable = true, total = 3 }: HeaderCase = {}) {
  const status: Distributor['status'] = isWritable ? 'active' : 'suspended';
  return textOf(
    renderStatic(
      <CatalogHeader
        distributor={{ ...DISTRIBUTOR, status }}
        managesCatalog={managesCatalog}
        isWritable={isWritable}
        total={total}
        isEditing={false}
        onAdd={() => {}}
      />,
    ),
  );
}

// PLAN 3.1: /central/catalogo.
describe('catalogue of the office', () => {
  it('gives the owner or the dispatcher of a writable distributor the one way to add a product', () => {
    const text = header();

    expect(text).toContain('Tu catálogo.');
    expect(text).toContain('Añadir producto');
    expect(text).not.toContain(STAFF_READS);
  });

  it('tells an account that does not set prices that it only reads, with nothing to add', () => {
    const text = header({ managesCatalog: false });

    expect(text).toContain('Catálogo y precios.');
    expect(text).toContain(STAFF_READS);
    expect(text).not.toContain('Añadir producto');
  });

  it('shows a suspended distributor read-only, under the notice that says why', () => {
    const text = header({ isWritable: false });

    expect(text).toContain('Hornilla suspendió tu distribuidora');
    expect(text).not.toContain('Añadir producto');
  });

  it('replaces the button with the limit once the thirty slots are used', () => {
    const text = header({ total: 30 });

    expect(text).toContain('Puedes tener hasta 30 productos, también los que no están a la venta.');
    expect(text).not.toContain('Añadir producto');
  });

  it('never draws a blank screen while the catalogue loads', () => {
    const account = accountOf({ current: workingAs([memberOf('owner')]) });
    const html = renderStatic(<CatalogPage />, {
      path: ROUTES.officeCatalog,
      shell: <AppShell area="office" />,
      account,
    });

    expect(textOf(html)).toContain('Tu catálogo.');
    expect(textOf(html)).toContain('Cargando el catálogo');
  });

  it('gives the driver the catalogue read-only in its own area', () => {
    const account = accountOf({ current: workingAs([memberOf('driver')]) });
    const html = renderStatic(<DriverCatalogPage />, {
      path: ROUTES.driverCatalog,
      shell: <AppShell area="driver" />,
      account,
    });

    expect(textOf(html)).toContain('Catálogo y precios.');
    expect(textOf(html)).toContain('Recarga: recoges el balón vacío.');
  });
});

// PLAN 3.1: "Carga tu catálogo" in the set-up list of the office home.
describe('catalogue task of the set-up list', () => {
  const task = (patch: Partial<Distributor>, canEdit = true) =>
    renderStatic(
      <SetupChecklist distributor={{ ...DISTRIBUTOR, ...patch }} isListed canEdit={canEdit} />,
    );

  it('invites to load the catalogue while nothing is on sale', () => {
    const html = task({ priceFromCents: null });

    expect(textOf(html)).toContain('Cargar catálogo');
    expect(textOf(html)).not.toContain('Carga tu catálogo (hecho)');
    expect(tags(html, 'a').some((tag) => tag.includes(`href="${ROUTES.officeCatalog}"`))).toBe(
      true,
    );
  });

  it('is done once a product is on sale', () => {
    const text = textOf(task({ priceFromCents: 3800 }));

    expect(text).toContain('Carga tu catálogo (hecho)');
    expect(text).toContain('Ver catálogo');
  });

  it('only offers to look at it on a read-only distributor', () => {
    expect(textOf(task({ priceFromCents: null }, false))).toContain('Ver catálogo');
  });
});
