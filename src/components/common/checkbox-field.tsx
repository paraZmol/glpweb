import { Check } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';
import { FieldError } from './text-field';

const CHECK_STROKE = 3;

type CheckboxFieldProps = Omit<
  ComponentProps<'input'>,
  'id' | 'type' | 'className' | 'children'
> & {
  /** The statement the person agrees to. May contain links. */
  children: ReactNode;
  error?: string;
  className?: string;
};

/** A box the person ticks by choice: never checked by default (see docs/legal). */
export function CheckboxField({ children, error, className, ...props }: CheckboxFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center">
          <input
            {...props}
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'peer size-6 cursor-pointer appearance-none rounded-[0.4375rem] border-[1.5px] border-input bg-card',
              'transition-colors motion-fast checked:border-foreground checked:bg-foreground',
              'aria-invalid:border-destructive',
            )}
          />
          <Check
            aria-hidden="true"
            className="pointer-events-none absolute size-4 text-background opacity-0 transition-opacity motion-fast peer-checked:opacity-100"
            strokeWidth={CHECK_STROKE}
          />
        </span>
        <label htmlFor={id} className="cursor-pointer py-0.5 text-[0.9375rem]">
          {children}
        </label>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
