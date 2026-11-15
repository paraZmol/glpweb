import { Check } from 'lucide-react';
import { useId } from 'react';
import { GasBrandTheme } from '@/components/brand/brand-theme';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { SALE_MODE_NAMES } from '@/components/catalog/sale-mode-selector';
import { CHIP_CLASS } from '@/components/catalog/weight-choice';
import { FieldError } from '@/components/common/text-field';
import type { Product } from '@/domain/catalog/product';
import { SALE_MODES, type SaleMode } from '@/domain/catalog/sale-mode';
import { formatMoney } from '@/domain/money/format';
import { listPriceOf } from '@/domain/pricing/discount';
import { GLYPH_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

const CYLINDER_HEIGHT_PX = 40;

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

type ProductPickProps = {
  /** The products it may name: on sale, sold that way. */
  products: readonly Product[];
  saleMode: SaleMode;
  value: readonly string[];
  /** A special price is for one product: then it behaves as a single choice. */
  isSingle: boolean;
  error?: string;
  onChange: (productIds: string[]) => void;
};

/**
 * "¿En qué productos?" (marketing §4, step 2): cards with the cylinder, the brand and the list
 * price of that way of selling, and "Todos" when the template takes several.
 */
export function ProductPick({
  products,
  saleMode,
  value,
  isSingle,
  error,
  onChange,
}: ProductPickProps) {
  const labelId = useId();
  const isAll = products.length > 0 && products.every((product) => value.includes(product.id));
  const toggle = (id: string) => {
    if (isSingle) return onChange([id]);
    return onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p id={labelId} className="text-[0.9375rem] font-semibold">
          {isSingle ? '¿En qué producto?' : '¿En qué productos?'}
        </p>
        {!isSingle && products.length > 1 && (
          <button
            type="button"
            aria-pressed={isAll}
            onClick={() => onChange(isAll ? [] : products.map((product) => product.id))}
            className={cn(
              CHIP_CLASS,
              'h-9 aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:inset-ring-foreground',
            )}
          >
            Todos
          </button>
        )}
      </div>
      <div
        role={isSingle ? 'radiogroup' : 'group'}
        aria-labelledby={labelId}
        className="grid gap-2 sm:grid-cols-2"
      >
        {products.map((product) => {
          const isChosen = value.includes(product.id);
          const price = listPriceOf(product, saleMode);
          return (
            <button
              key={product.id}
              type="button"
              role={isSingle ? 'radio' : 'checkbox'}
              aria-checked={isChosen}
              onClick={() => toggle(product.id)}
              className={cn(
                'press flex items-center gap-3 rounded-lg p-2.5 text-left motion-instant inset-ring-[1.5px] inset-ring-input',
                isChosen && 'inset-ring-2 inset-ring-foreground',
              )}
            >
              <GasBrandTheme color={product.brandColor} className="shrink-0">
                <span className="grid h-12 w-12 place-items-end justify-center rounded-md bg-gas-brand-soft">
                  <GasCylinder weightKg={product.weightKg} height={CYLINDER_HEIGHT_PX} />
                </span>
              </GasBrandTheme>
              <span className="min-w-0 flex-1">
                <span className="block font-bold wrap-break-word">{product.name}</span>
                <span className="block text-sm text-muted-foreground">{product.brand}</span>
                {price !== null && (
                  <span className="block font-heading font-bold tabular-nums">
                    {formatMoney(price, product.currency)}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full inset-ring-[1.5px] inset-ring-input',
                  isChosen && 'bg-foreground text-background inset-ring-foreground',
                )}
              >
                {isChosen && <Check className="size-4" strokeWidth={GLYPH_STROKE} />}
              </span>
            </button>
          );
        })}
      </div>
      {error && <FieldError id={`${labelId}-error`}>{error}</FieldError>}
    </div>
  );
}
