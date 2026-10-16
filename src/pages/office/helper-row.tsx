import { type FormEvent, useState } from 'react';
import { Button } from '@/components/common/button';
import { StateChip } from '@/components/common/state-chip';
import { TextField } from '@/components/common/text-field';
import { HELPER_NAME_MAX_LENGTH } from '@/domain/staff/constants';
import type { Helper } from '@/domain/staff/helper';
import type { OnFieldError } from './helper-add';

type HelperRowProps = {
  helper: Helper;
  /** Null on a read-only distributor: the row only reads. */
  controls: {
    isLocked: boolean;
    busy: 'name' | 'active' | null;
    onRename: (name: string, onFieldError: OnFieldError) => Promise<boolean>;
    onActive: (active: boolean) => Promise<boolean>;
  } | null;
};

/**
 * One helper (PLAN 3.2): a name and whether the driver can still choose it. Switching it off
 * asks nothing — it is undone with one tap and the helper keeps its place.
 */
export function HelperRow({ helper, controls }: HelperRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const edit = (next: string | null) => {
    setDraft(next);
    setError(undefined);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (controls && draft !== null)
      void controls.onRename(draft, setError).then((done) => done && edit(null));
  };

  if (controls && draft !== null) {
    return (
      <form noValidate onSubmit={submit} className="flex flex-col gap-3 py-3">
        <TextField
          label={`Nuevo nombre de ${helper.name}`}
          name="helperName"
          autoComplete="off"
          maxLength={HELPER_NAME_MAX_LENGTH}
          value={draft}
          error={error}
          autoFocus
          onChange={(event) => edit(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="line" size="sm" onClick={() => edit(null)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="ink"
            size="sm"
            disabled={controls.isLocked && controls.busy !== 'name'}
            loading={controls.busy === 'name'}
            loadingLabel="Guardando…"
          >
            Guardar nombre
          </Button>
        </div>
      </form>
    );
  }

  return (
    <article className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
      <div className="flex min-w-0 flex-col items-start gap-1">
        <h3 className="max-w-full font-heading text-base font-bold wrap-anywhere">{helper.name}</h3>
        {helper.active ? (
          <StateChip state="free">Disponible</StateChip>
        ) : (
          <StateChip state="offline">No disponible</StateChip>
        )}
      </div>
      {controls && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="line"
            size="sm"
            disabled={controls.isLocked}
            onClick={() => edit(helper.name)}
          >
            Renombrar<span className="sr-only"> a {helper.name}</span>
          </Button>
          <Button
            type="button"
            variant={helper.active ? 'quiet' : 'soft'}
            size="sm"
            disabled={controls.isLocked && controls.busy !== 'active'}
            loading={controls.busy === 'active'}
            loadingLabel="Guardando…"
            onClick={() => void controls.onActive(!helper.active)}
          >
            {helper.active ? 'Desactivar' : 'Activar'}
            <span className="sr-only"> a {helper.name}</span>
          </Button>
        </div>
      )}
    </article>
  );
}
