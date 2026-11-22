import { describe, expect, it } from 'vitest';
import { accountOf, memberOf, workingAs } from '../../../tests/support/account-fixtures';
import { renderStatic, textOf } from '../../../tests/support/render-static';
import { AppShell } from '../../components/layout/app-shell';
import { ROUTES } from '../../lib/routes';
import { DriverPromotionsPage } from '../driver/promotions';
import { DriverVehiclesPage } from '../driver/vehicles';
import { PromotionsPage } from './promotions';
import { PlantStockPage } from './stock';
import { VehiclesPage } from './vehicles';

const as = (role: 'owner' | 'dispatcher' | 'driver') =>
  accountOf({ current: workingAs([memberOf(role)]) });

// PLAN 3.3–3.5: none of the new screens draws a blank page while its data loads.
describe('vehicles, plant stock and promotions', () => {
  it.each([
    ['owner', VehiclesPage, ROUTES.officeVehicles, 'Tus vehículos.', 'Cargando los vehículos'],
    ['dispatcher', PlantStockPage, ROUTES.officeStock, 'Stock de planta.', 'Cargando el stock'],
    [
      'owner',
      PromotionsPage,
      ROUTES.officePromotions,
      'Tus promociones.',
      'Cargando las promociones',
    ],
  ] as const)(
    'the %s opens %s with its title and its skeleton',
    (role, Page, path, title, loading) => {
      const html = renderStatic(<Page />, {
        path,
        shell: <AppShell area="office" />,
        account: as(role),
      });

      expect(textOf(html)).toContain(title);
      expect(textOf(html)).toContain(loading);
    },
  );

  it.each([
    [DriverVehiclesPage, ROUTES.driverVehicles, 'Vehículos.'],
    [DriverPromotionsPage, ROUTES.driverPromotions, 'Promociones.'],
  ] as const)('gives the driver %s read-only in its own area', (Page, path, title) => {
    const html = renderStatic(<Page />, {
      path,
      shell: <AppShell area="driver" />,
      account: as('driver'),
    });

    expect(textOf(html)).toContain(title);
    expect(textOf(html)).not.toContain('Añadir');
  });
});
