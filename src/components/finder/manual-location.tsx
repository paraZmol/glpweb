import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/common/button';
import { TextField } from '@/components/common/text-field';

const NOT_RECOGNISED = 'No reconocimos esas coordenadas. Deben verse así: -12.0464, -77.0428';

type ManualLocationProps = {
  /** Returns false when the text holds no coordinates. */
  onSubmit: (text: string) => boolean;
  /** Open from the start: the device could not say where it is. */
  startsOpen: boolean;
};

/**
 * The manual way of giving a point while there is no map nor address search (PLAN 2.6): the
 * two numbers any maps app shows for a place.
 */
export function ManualLocation({ onSubmit, startsOpen }: ManualLocationProps) {
  const panelId = useId();
  const [hasOpened, setOpened] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const isOpen = hasOpened || startsOpen;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(onSubmit(text) ? undefined : NOT_RECOGNISED);
  };

  if (!isOpen) {
    return (
      <Button
        variant="line"
        aria-expanded={false}
        aria-controls={panelId}
        onClick={() => setOpened(true)}
      >
        Escribir las coordenadas
      </Button>
    );
  }

  return (
    <form id={panelId} noValidate onSubmit={submit} className="flex flex-col gap-3">
      <TextField
        label="Coordenadas del punto"
        name="coordinates"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="-12.0464, -77.0428"
        value={text}
        onChange={(event) => setText(event.target.value)}
        error={error}
        hint="En tu app de mapas, mantén presionado el lugar y copia los dos números que aparecen."
      />
      <Button type="submit" variant="ink">
        Buscar aquí
      </Button>
    </form>
  );
}
