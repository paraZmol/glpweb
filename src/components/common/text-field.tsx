import { CircleAlert } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { GLYPH_STROKE } from '@/lib/icons';
import { shakeAnimation } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type TextFieldProps = Omit<ComponentProps<'input'>, 'id' | 'className'> & {
  /** Always visible above the field; a placeholder is never the label. */
  label: string;
  /** Message under the field when its value was rejected. */
  error?: string;
  /** Standing help under the field ("Mínimo 8 caracteres."). May carry a link. */
  hint?: ReactNode;
  /** Control placed inside the field, at its right edge (show password, clear…). */
  trailing?: ReactNode;
  className?: string;
};

/** Paragraph under a control that explains why its value was rejected. Never colour alone. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-destructive">
      <CircleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
        strokeWidth={GLYPH_STROKE}
      />
      <span>{children}</span>
    </p>
  );
}

/** Field of ui-system §8: label on top, 48 px tall, radius 16, with help and error message. */
export function TextField({
  label,
  error,
  hint,
  trailing,
  className,
  'aria-invalid': isMarkedInvalid,
  ...props
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const isReduced = useReducedMotion() ?? false;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.9375rem] font-semibold">
        {label}
      </label>
      <m.div className="relative" animate={error ? shakeAnimation(isReduced) : { x: 0 }}>
        <input
          {...props}
          id={id}
          // A field can also be wrong as part of a group whose message is shown once, outside.
          aria-invalid={error || isMarkedInvalid ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'h-12 w-full rounded-lg border-[1.5px] border-input bg-muted px-4 text-base',
            'text-foreground transition-colors motion-fast placeholder:text-muted-foreground',
            'read-only:border-border read-only:text-muted-foreground',
            'aria-invalid:border-destructive disabled:opacity-60',
            trailing !== undefined && 'pr-13',
          )}
        />
        {trailing !== undefined && (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        )}
      </m.div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
