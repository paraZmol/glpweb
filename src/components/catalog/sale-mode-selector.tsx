import { SALE_MODES, type SaleMode } from '@/domain/catalog/sale-mode';
import { formatMoney } from '@/domain/money/format';
import { cn } from '@/lib/utils';

// Names and support texts fixed by docs/marketing/oferta-y-promociones.md §2.1 and §2.2.
export const SALE_MODE_NAMES: Record<SaleMode, string> = {
  refill: 'Recarga',
  full: 'Balón completo',
};
export const SALE_MODE_SUPPORT: Record<SaleMode, string> = {
  refill: 'Cambias tu balón vacío por uno lleno',
  full: 'Gas + envase. No entregas vacío · No incluye regulador ni manguera',
};

type SaleModeSelectorProps = {
  /** What the group is about, for screen readers: "Balón 10 kg Marca Uno". */
  label: string;
  mode: SaleMode;
  onChange: (mode: SaleMode) => void;
  priceCents: Record<SaleMode, number>;
  currency: string;
};

/**
 * Two segments, each with its price; refill always on the left and chosen on arrival. The
 * choice is said by shape (the raised segment) and by `aria-checked`, not by colour alone.
 */
export function SaleModeSelector({
  label,
  mode,
  onChange,
  priceCents,
  currency,
}: SaleModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={`Forma de compra de ${label}`}
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
    >
      {SALE_MODES.map((option) => {
        const isChosen = option === mode;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isChosen}
            onClick={() => onChange(option)}
            className={cn(
              'press flex min-h-12 flex-col items-start justify-center rounded-md px-3 py-1.5 text-left transition-colors motion-fast',
              isChosen ? 'bg-card shadow-card' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="text-[0.8125rem] leading-tight font-bold">
              {SALE_MODE_NAMES[option]}
            </span>
            <span className="font-heading text-lg leading-tight font-extrabold tabular-nums">
              {formatMoney(priceCents[option], currency)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
