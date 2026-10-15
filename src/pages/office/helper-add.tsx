import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/common/button';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { TextField } from '@/components/common/text-field';
import { HELPER_NAME_MAX_LENGTH } from '@/domain/staff/constants';
import { ICON_STROKE } from '@/lib/icons';

type AddHelperProps = { isLocked: boolean; onAdd: (name: string) => Promise<boolean> };

/** The name of a new helper, added with one button. */
export function AddHelper({ isLocked, onAdd }: AddHelperProps) {
  const [name, setName] = useState('');
  const [isAdding, setAdding] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAdding(true);
    void onAdd(name).then((done) => {
      setAdding(false);
      if (done) setName('');
    });
  };
  return (
    <form noValidate onSubmit={submit} className="mt-4 flex items-end gap-2">
      <TextField
        label="Nombre del ayudante"
        name="newHelper"
        autoComplete="off"
        maxLength={HELPER_NAME_MAX_LENGTH}
        className="min-w-0 flex-1"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button
        type="submit"
        variant="soft"
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
