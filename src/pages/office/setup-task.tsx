import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { GLYPH_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

const COMING_SOON = 'Llega pronto';

type TaskProps = {
  title: string;
  detail: string;
  isDone?: boolean;
  /** What the owner can do about it today; a task without it is not available yet. */
  action?: ReactNode;
};

/** One line of "Completa tu distribuidora": done or not, and what to do about it. */
export function Task({ title, detail, isDone = false, action }: TaskProps) {
  return (
    // Phone: the action goes under the words, which keep the whole width of the row.
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full',
          isDone
            ? 'bg-state-free text-state-free-foreground'
            : 'inset-ring-[1.5px] inset-ring-input',
        )}
      >
        {isDone && <Check className="size-4" strokeWidth={GLYPH_STROKE} />}
      </span>
      <p className={cn('min-w-0 text-muted-foreground', action && 'max-sm:col-span-2')}>
        <strong className="block font-heading text-base text-foreground">
          {title}
          {isDone && <span className="sr-only"> (hecho)</span>}
        </strong>
        {detail}
      </p>
      {action ? (
        <div className="max-sm:col-span-2 max-sm:col-start-2">{action}</div>
      ) : (
        !isDone && (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[0.8125rem] font-bold text-muted-foreground">
            {COMING_SOON}
          </span>
        )
      )}
    </li>
  );
}
