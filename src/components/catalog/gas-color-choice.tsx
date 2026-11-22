import { Ban } from 'lucide-react';
import { useId } from 'react';
import { FieldError } from '@/components/common/text-field';
import { normalizeHex } from '@/domain/brand/color';
import { HORNILLA_BRAND_COLOR } from '@/domain/brand/derive-brand';
import { SUGGESTED_BRAND_COLORS } from '@/domain/brand/palette';
import { ICON_STROKE } from '@/lib/icons';

const SWATCH_CLASS =
  'press grid size-11 place-items-center rounded-full shadow-card inset-ring-[1.5px] inset-ring-foreground/15 ring-foreground ring-offset-4 ring-offset-card motion-instant aria-checked:ring-2';

type GasColorChoiceProps = {
  /** `#rrggbb`, or empty for none. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

/**
 * Colour of the gas brand (optional): it paints the cylinder of the product, never the buttons
 * (ui-system §6). The same tested palette as the brand of a distributor, "Sin color" and the
 * device's own picker for the exact tone of the brand.
 */
export function GasColorChoice({ value, error, onChange }: GasColorChoiceProps) {
  const labelId = useId();
  const chosen = normalizeHex(value);
  const isSuggested = SUGGESTED_BRAND_COLORS.some((suggested) => suggested.color === chosen);

  return (
    <div>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        Color de la marca <span className="font-normal text-muted-foreground">(opcional)</span>
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap items-center gap-x-3 gap-y-4 pt-1 pl-1"
      >
        <button
          type="button"
          role="radio"
          aria-checked={value === ''}
          aria-label="Sin color"
          title="Sin color"
          onClick={() => onChange('')}
          className={`${SWATCH_CLASS} bg-muted text-muted-foreground`}
        >
          <Ban aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
        </button>
        {SUGGESTED_BRAND_COLORS.map((suggested) => (
          <button
            key={suggested.color}
            type="button"
            role="radio"
            aria-checked={chosen === suggested.color}
            aria-label={suggested.name}
            title={suggested.name}
            onClick={() => onChange(suggested.color)}
            // The colour is data, not a token: it is the colour of a gas brand.
            style={{ backgroundColor: suggested.color }}
            className={SWATCH_CLASS}
          />
        ))}
        <label
          className={`${SWATCH_CLASS} relative cursor-pointer overflow-hidden bg-muted data-[checked=true]:ring-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid`}
          data-checked={value !== '' && !isSuggested}
          title="Otro color"
          style={chosen && !isSuggested ? { backgroundColor: chosen } : undefined}
        >
          <span className="sr-only">Otro color</span>
          <input
            type="color"
            value={chosen ?? HORNILLA_BRAND_COLOR}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          {(!chosen || isSuggested) && (
            <span aria-hidden="true" className="font-heading text-xl font-bold">
              +
            </span>
          )}
        </label>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Pinta el balón en tu página. Sin color, toma el de tu distribuidora.
      </p>
      {error && <FieldError id={`${labelId}-error`}>{error}</FieldError>}
    </div>
  );
}
