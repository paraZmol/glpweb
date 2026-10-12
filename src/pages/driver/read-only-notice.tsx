import { Lock } from 'lucide-react';
import { isSuspendedByPlatform } from '@/domain/tenancy/status';
import type { Distributor } from '@/domain/tenancy/types';
import { ICON_STROKE } from '@/lib/icons';

/**
 * What a driver reads while the distributor is read-only (PLAN 5.4): why nothing arrives, that
 * it is not theirs to fix and whom to tell. Ink block, as the driver ambient writes what
 * matters (ui-system §13). It follows the distributor live, like the notice of the office.
 */
export function DriverReadOnlyNotice({ distributor }: { distributor: Distributor }) {
  const isSuspended = isSuspendedByPlatform(distributor.status);
  return (
    <div
      role="status"
      className="flex max-w-2xl items-start gap-3 rounded-lg bg-foreground p-4 text-background lg:p-5"
    >
      <Lock aria-hidden="true" className="mt-0.5 size-6 shrink-0" strokeWidth={ICON_STROKE} />
      <div className="min-w-0">
        <p className="font-heading text-xl font-bold">
          {isSuspended ? 'Distribuidora suspendida.' : 'Distribuidora en solo lectura.'}
        </p>
        <p className="mt-1 font-semibold wrap-anywhere">
          {isSuspended
            ? `Hornilla suspendió ${distributor.name}: está en solo lectura`
            : `${distributor.name} está en solo lectura`}{' '}
          y por ahora no entran pedidos ni se abren jornadas. No depende de ti: avísale a quien es
          titular de la distribuidora.
        </p>
      </div>
    </div>
  );
}
