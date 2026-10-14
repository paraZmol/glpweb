import { useId, useState } from 'react';
import { FieldError, TextField } from '@/components/common/text-field';

/** The weights sold in Peru (glp-domain §5); any other whole weight goes in "Otro peso". */
const COMMON_WEIGHTS_KG = ['3', '5', '10', '15', '45'] as const;
const OTHER = 'Otro peso';

export const CHIP_CLASS =
  'press h-11 rounded-full px-4 font-heading text-[0.9375rem] font-bold tabular-nums motion-instant inset-ring-[1.5px] inset-ring-input aria-checked:bg-foreground aria-checked:text-background aria-checked:inset-ring-foreground';

type WeightChoiceProps = {
  /** Whole kilograms as typed. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

/**
 * The weight of a new product (PLAN 3.1): chips for the usual ones, a field for any other. A
 * product never changes weight afterwards (another weight is another product, with its stock).
 */
export function WeightChoice({ value, error, onChange }: WeightChoiceProps) {
  const labelId = useId();
  const [isOther, setOther] = useState(
    () => !(COMMON_WEIGHTS_KG as readonly string[]).includes(value),
  );
  const choose = (weight: string | null) => {
    setOther(weight === null);
    onChange(weight ?? '');
  };

  return (
    <div>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        Peso del balón
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {COMMON_WEIGHTS_KG.map((weight) => (
          <button
            key={weight}
            type="button"
            role="radio"
            aria-checked={!isOther && value === weight}
            onClick={() => choose(weight)}
            className={CHIP_CLASS}
          >
            {weight} kg
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={isOther}
          onClick={() => choose(null)}
          className={CHIP_CLASS}
        >
          {OTHER}
        </button>
      </div>
      {isOther ? (
        <TextField
          label="Peso en kilos"
          name="weightKg"
          inputMode="numeric"
          autoComplete="off"
          className="mt-3 max-w-48"
          value={value}
          error={error}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        error && <FieldError id={`${labelId}-error`}>{error}</FieldError>
      )}
    </div>
  );
}

/** The weight of an existing product, said and not offered. */
export function FixedWeight({ weightKg }: { weightKg: number }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.9375rem] font-semibold">Peso del balón</p>
      <p className="font-heading text-lg font-bold tabular-nums">{weightKg} kg</p>
      <p className="mt-1 text-sm text-muted-foreground">
        El peso no se cambia: otro peso es otro producto. Si ya no lo vendes, quítalo de la venta y
        añade el nuevo.
      </p>
    </div>
  );
}
