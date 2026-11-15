import { useId } from 'react';
import { SALE_MODE_NAMES } from '@/components/catalog/sale-mode-selector';
import { CHIP_CLASS } from '@/components/catalog/weight-choice';
import { SALE_MODES, type SaleMode } from '@/domain/catalog/sale-mode';

/** "Recarga" · "Balón completo": two chips, fixed in the templates of the full cylinder. */
export function SaleModeChips({
  value,
  onChange,
}: {
  value: SaleMode;
  onChange: (mode: SaleMode) => void;
}) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        Forma de venta
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {SALE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => onChange(mode)}
            className={CHIP_CLASS}
          >
            {SALE_MODE_NAMES[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
