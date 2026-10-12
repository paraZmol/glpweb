import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { ICON_STROKE } from '@/lib/icons';
import { TextField, type TextFieldProps } from './text-field';

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'trailing'>;

/** Password field with a "show" toggle, so nobody has to type it twice to be sure. */
export function PasswordField(props: PasswordFieldProps) {
  const [isVisible, setVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <TextField
      {...props}
      type={isVisible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          aria-pressed={isVisible}
          aria-label="Mostrar contraseña"
          onClick={() => setVisible((current) => !current)}
          className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors motion-fast hover:text-foreground"
        >
          <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
        </button>
      }
    />
  );
}
