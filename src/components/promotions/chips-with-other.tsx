import { useId, useState } from 'react';
import { CHIP_CLASS } from '@/components/catalog/weight-choice';
import { FieldError, TextField } from '@/components/common/text-field';

type ChipsWithOtherProps = {
  label: string;
  chips: readonly string[];
  chipText: (value: string) => string;
  value: string;
  otherLabel: string;
  error?: string;
  onChange: (value: string) => void;
};

/** Chips for the usual numbers and "Otro" with a field (marketing §4: no drop-downs). */
export function ChipsWithOther({
  label,
  chips,
  chipText,
  value,
  otherLabel,
  error,
  onChange,
}: ChipsWithOtherProps) {
  const labelId = useId();
  const [isOther, setOther] = useState(() => !chips.includes(value));
  const choose = (chip: string | null) => {
    setOther(chip === null);
    onChange(chip ?? '');
  };
  return (
    <div>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            role="radio"
            aria-checked={!isOther && value === chip}
            onClick={() => choose(chip)}
            className={CHIP_CLASS}
          >
            {chipText(chip)}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={isOther}
          onClick={() => choose(null)}
          className={CHIP_CLASS}
        >
          Otro
        </button>
      </div>
      {isOther ? (
        <TextField
          label={otherLabel}
          name="dealOther"
          inputMode="decimal"
          autoComplete="off"
          className="mt-3 max-w-60"
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
