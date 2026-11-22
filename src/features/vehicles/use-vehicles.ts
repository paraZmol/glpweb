import { listVehicles } from '../../data/vehicles-repo';
import type { Vehicle } from '../../domain/vehicles/vehicle';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useRefreshOnReturn } from '../../lib/use-refresh-on-return';

/**
 * The vehicles of a distributor, in use first (PLAN 3.3): its whole staff reads them; the owner
 * and the dispatcher write (`canEditVehicles`). Pass null while the distributor is not known.
 * Not live: read when the screen opens and each time the person comes back to it; call
 * `reload()` after a write. Cost per load: one read per vehicle (one when there is none) plus 1
 * by the rules. `PermissionDeniedError` for an account that does not work there.
 */
export function useVehicles(distributorId: string | null): ReloadableResource<Vehicle[]> {
  const vehicles = useAsyncResource(distributorId && `vehicles:${distributorId}`, () =>
    listVehicles(distributorId ?? ''),
  );
  useRefreshOnReturn(vehicles.reload, distributorId !== null);
  return vehicles;
}
