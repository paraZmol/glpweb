import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { FieldError } from '@/components/common/text-field';
import { MAX_COVERAGE_RADIUS_KM, MIN_COVERAGE_RADIUS_KM } from '@/domain/tenancy/constants';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

const PRESETS_KM = [3, 5, 10, 20];
const STEP_BUTTON =
  'press-stepper grid size-11 place-items-center rounded-full transition-colors motion-instant disabled:opacity-40';

type RadiusStepperProps = {
  value: number;
  onChange: (radiusKm: number) => void;
  error?: string;
};

/** Coverage radius in whole kilometres: the +/− stepper of ui-system §8 plus four shortcuts. */
export function RadiusStepper({ value, onChange, error }: RadiusStepperProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const clamp = (radiusKm: number) =>
    Math.min(MAX_COVERAGE_RADIUS_KM, Math.max(MIN_COVERAGE_RADIUS_KM, radiusKm));

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={error ? errorId : undefined}>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        Radio de cobertura
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
          <button
            type="button"
            aria-label="Reducir el radio un kilómetro"
            disabled={value <= MIN_COVERAGE_RADIUS_KM}
            onClick={() => onChange(clamp(value - 1))}
            className={cn(STEP_BUTTON, 'bg-card shadow-card')}
          >
            <Minus aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
          </button>
          <output
            aria-live="polite"
            className="min-w-18 text-center font-heading text-lg font-bold tabular-nums"
          >
            {value} km
          </output>
          <button
            type="button"
            aria-label="Ampliar el radio un kilómetro"
            disabled={value >= MAX_COVERAGE_RADIUS_KM}
            onClick={() => onChange(clamp(value + 1))}
            className={cn(STEP_BUTTON, 'bg-primary text-primary-foreground')}
          >
            <Plus aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS_KM.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={preset === value}
              onClick={() => onChange(preset)}
              className="press min-h-10 rounded-full px-3.5 text-[0.9375rem] font-semibold tabular-nums inset-ring-[1.5px] inset-ring-border transition-colors motion-fast aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:inset-ring-foreground"
            >
              {preset} km
            </button>
          ))}
        </div>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
      <p className="mt-1.5 text-sm text-muted-foreground">
        Hasta dónde repartes, medido desde la planta. Lo puedes cambiar después.
      </p>
    </div>
  );
}
