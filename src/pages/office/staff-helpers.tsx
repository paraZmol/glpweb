import { InlineAlert } from '@/components/common/inline-alert';
import { ErrorState } from '@/components/common/state-views';
import { Panel } from '@/components/layout/page-header';
import { MAX_HELPERS } from '@/domain/staff/constants';
import { HelperLimitError } from '@/domain/staff/errors';
import type { Helper } from '@/domain/staff/helper';
import { addHelper, renameHelper, setHelperActive } from '@/features/staff/staff-actions';
import { describeStaffError } from '@/features/staff/staff-messages';
import { useHelpers } from '@/features/staff/use-staff';
import { useLastReady } from '@/lib/use-last-ready';
import { AddHelper, HelpersSkeleton } from './helper-add';
import { HelperRow } from './helper-row';
import { useStaffWrite } from './use-staff-write';

type StaffHelpersProps = { distributorId: string; canEdit: boolean; isOnline: boolean };

/**
 * Helpers (PLAN 3.2): people who go with a driver in the truck and never sign in. The driver
 * picks one when opening a shift (phase 5). Only a name; never removed, only switched off; up
 * to `MAX_HELPERS`, switched-off ones included.
 */
export function StaffHelpers({ distributorId, canEdit, isOnline }: StaffHelpersProps) {
  const helpers = useHelpers(distributorId);
  const { data, isRefreshing } = useLastReady(helpers, distributorId);
  const write = useStaffWrite(helpers.reload);
  const isLocked = write.busy !== null || isRefreshing || !isOnline;

  if (helpers.status === 'error' && !data) {
    return (
      <ErrorState
        title="No pudimos cargar a tus ayudantes."
        description="Puede ser la conexión. Vuelve a intentar en un momento."
        onRetry={helpers.reload}
        className="rounded-lg"
      />
    );
  }
  const available = data?.filter((helper) => helper.active).length ?? 0;
  const isFull = (data?.length ?? 0) >= MAX_HELPERS;
  const controlsOf = (helper: Helper) => ({
    isLocked,
    busy:
      write.busy === `${helper.id}:name`
        ? ('name' as const)
        : write.busy === `${helper.id}:active`
          ? ('active' as const)
          : null,
    onRename: (name: string) =>
      write.run(
        `${helper.id}:name`,
        () => renameHelper(distributorId, helper.id, name),
        'Guardamos el nombre.',
      ),
    onActive: (isOn: boolean) =>
      write.run(
        `${helper.id}:active`,
        () => setHelperActive(distributorId, helper.id, isOn),
        isOn
          ? `${helper.name} vuelve a estar disponible.`
          : `${helper.name} ya no se ofrece al abrir una jornada.`,
      ),
  });

  return (
    <Panel dense>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold">Ayudantes</h2>
        {data && (
          <p className="text-sm font-semibold text-muted-foreground tabular-nums">
            {available} {available === 1 ? 'disponible' : 'disponibles'} · {data.length} de{' '}
            {MAX_HELPERS}
          </p>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        Van con el repartidor en el camión y no entran a Hornilla: solo guardamos su nombre.
      </p>
      {!data && <HelpersSkeleton />}
      {data?.length === 0 && <p className="mt-3 font-semibold">Todavía no tienes ayudantes.</p>}
      {data && data.length > 0 && (
        <div className="mt-1 flex flex-col divide-y">
          {data.map((helper) => (
            <HelperRow
              key={helper.id}
              helper={helper}
              controls={canEdit ? controlsOf(helper) : null}
            />
          ))}
        </div>
      )}
      {canEdit && data && !isFull && (
        <AddHelper
          isLocked={isLocked}
          onAdd={(name) =>
            write.run('new', () => addHelper(distributorId, name), `Añadimos a ${name.trim()}.`)
          }
        />
      )}
      {canEdit && isFull && (
        <InlineAlert tone="info" className="mt-4">
          {describeStaffError(new HelperLimitError(MAX_HELPERS))}
        </InlineAlert>
      )}
    </Panel>
  );
}
