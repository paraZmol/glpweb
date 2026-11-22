import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/common/button';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { TextField } from '@/components/common/text-field';
import { HELPER_NAME_MAX_LENGTH } from '@/domain/staff/constants';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { SOFT_ROW_TEXT } from './row-button';

/** Says why a name was refused, under its field. */
export type OnFieldError = (message: string) => void;

type AddHelperProps = {
  isLocked: boolean;
  onAdd: (name: string, onFieldError: OnFieldError) => Promise<boolean>;
};

/**
 * The name of a new helper, added with one button. A name that cannot be saved is explained
 * under the field, where the person looks when it tries again; the button sits beside the field
 * and drops under it once there is a message, so they never fall out of line.
 */
export function AddHelper({ isLocked, onAdd }: AddHelperProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isAdding, setAdding] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAdding(true);
    setError(undefined);
    void onAdd(name, setError).then((done) => {
      setAdding(false);
      if (done) setName('');
    });
  };
  return (
    <form
      noValidate
      onSubmit={submit}
      className={cn('mt-4 flex gap-2', error ? 'flex-col items-end' : 'items-end')}
    >
      <TextField
        label="Nombre del ayudante"
        name="newHelper"
        autoComplete="off"
        maxLength={HELPER_NAME_MAX_LENGTH}
        className="w-full min-w-0 flex-1"
        value={name}
        error={error}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
      />
      <Button
        type="submit"
        variant="soft"
        className={SOFT_ROW_TEXT}
        disabled={isLocked && !isAdding}
        loading={isAdding}
        loadingLabel="Añadiendo…"
      >
        <Plus aria-hidden="true" strokeWidth={ICON_STROKE} />
        Añadir
      </Button>
    </form>
  );
}

export function HelpersSkeleton() {
  return (
    <LoadingRegion label="Cargando a tus ayudantes" className="mt-3 flex flex-col gap-3">
      <Bone className="h-5 w-40" />
      <Bone className="h-5 w-32" />
    </LoadingRegion>
  );
}
