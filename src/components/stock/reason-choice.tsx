import { ClipboardCheck, type LucideIcon, NotebookPen, ShieldAlert, Truck } from 'lucide-react';
import { useId } from 'react';
import { ADJUSTMENT_REASONS, type AdjustmentReason } from '@/domain/stock/movement';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

/** The four reasons as cards: a short name and what each one asks for (PLAN 3.4). */
const REASON_CARDS: Record<AdjustmentReason, { title: string; text: string; icon: LucideIcon }> = {
  count: { title: 'Conteo físico', text: 'Escribe lo que contaste', icon: ClipboardCheck },
  supplier: { title: 'Proveedor', text: 'Llegaron llenos o se llevaron vacíos', icon: Truck },
  damaged: { title: 'Dañado o con fuga', text: 'Balones que salen del stock', icon: ShieldAlert },
  other: { title: 'Otro motivo', text: 'Con una nota que lo explique', icon: NotebookPen },
};

type ReasonChoiceProps = {
  value: AdjustmentReason;
  onChange: (reason: AdjustmentReason) => void;
};

/** Every adjustment says why; cards instead of a drop-down (design-craft §2). */
export function ReasonChoice({ value, onChange }: ReasonChoiceProps) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        Motivo del ajuste
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-2">
        {ADJUSTMENT_REASONS.map((reason) => {
          const { title, text, icon: Icon } = REASON_CARDS[reason];
          return (
            <button
              key={reason}
              type="button"
              role="radio"
              aria-checked={reason === value}
              onClick={() => onChange(reason)}
              className={cn(
                'press flex min-h-20 flex-col items-start gap-1 rounded-lg p-3 text-left motion-instant',
                'inset-ring-[1.5px] inset-ring-input',
                'aria-checked:bg-foreground aria-checked:text-background aria-checked:inset-ring-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
              <span className="font-heading text-[0.9375rem] leading-tight font-bold">{title}</span>
              <span className="text-[0.8125rem] leading-tight opacity-80">{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
