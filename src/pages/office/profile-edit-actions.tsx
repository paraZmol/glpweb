import { Button, ButtonLink } from '@/components/common/button';
import { ConfirmPanel } from '@/components/common/confirm-panel';
import { InlineAlert } from '@/components/common/inline-alert';
import { ROUTES } from '@/lib/routes';

const SAVING = 'Guardando los cambios…';
// PLAN 5.4: the suspension (or the end of the plan) arrived with the form half edited.
export const LEFT_UNSAVED =
  'Tu distribuidora pasó a solo lectura mientras editabas. Lo que escribiste sigue a la vista, pero no se guardó y ahora no se puede guardar.';

type ProfileEditActionsProps = {
  /** Read-only distributor: there is nothing to press. */
  readOnly: boolean;
  /** Something typed differs from what is stored. */
  hasUnsaved: boolean;
  /** The save would take an approved listing out of the search: it asks once more. */
  isConfirming: boolean;
  /** What that costs, said again inside the question. */
  cost: string;
  isRunning: boolean;
  isOnline: boolean;
  onKeepEditing: () => void;
};

/**
 * The foot of the profile form (PLAN 2.11): the button that saves, the question before a save
 * that sends the listing back to review, or — on a read-only distributor — no button at all.
 * Its submit buttons belong to the form around it.
 */
export function ProfileEditActions(props: ProfileEditActionsProps) {
  const { readOnly, hasUnsaved, isConfirming, cost, isRunning, isOnline, onKeepEditing } = props;
  if (readOnly) return hasUnsaved ? <InlineAlert tone="info">{LEFT_UNSAVED}</InlineAlert> : null;
  if (isConfirming) {
    return (
      <ConfirmPanel
        title="¿Guardar y volver a revisión?"
        actions={
          <>
            <Button type="button" variant="line" disabled={isRunning} onClick={onKeepEditing}>
              Seguir editando
            </Button>
            <Button type="submit" variant="ink" loading={isRunning} loadingLabel={SAVING}>
              Guardar y enviar a revisión
            </Button>
          </>
        }
      >
        <p className="mt-1 text-muted-foreground">{cost}</p>
      </ConfirmPanel>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="submit" loading={isRunning} loadingLabel={SAVING} disabled={!isOnline}>
        Guardar cambios
      </Button>
      <ButtonLink to={ROUTES.officeHome} variant="line">
        Cancelar
      </ButtonLink>
    </div>
  );
}
