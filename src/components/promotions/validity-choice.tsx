import { useId } from 'react';
import { CHIP_CLASS } from '@/components/catalog/weight-choice';
import { FieldError, TextField } from '@/components/common/text-field';
import type { ValidityWindow } from '@/domain/pricing/validity';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import type {
  PromotionForm,
  ValidityChoice as Choice,
} from '@/features/promotions/promotion-templates';
import { whenText, withStop } from '@/features/promotions/promotion-texts';

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'today', label: 'Solo hoy' },
  { value: 'weekend', label: 'Este fin de semana' },
  { value: 'days7', label: '7 días' },
  { value: 'days15', label: '15 días' },
  { value: 'days30', label: '30 días' },
  { value: 'todayHours', label: 'Solo hoy, por horas' },
  { value: 'dates', label: 'Elegir fechas' },
];

/** "Empieza ahora y termina el domingo 18 de octubre, 8:00 p. m." */
export function windowSentence(window: ValidityWindow): string {
  const start = window.startsAt === 'now' ? 'ahora' : whenText(window.startsAt, DEFAULT_TIMEZONE);
  return withStop(`Empieza ${start} y termina ${whenText(window.endsAt, DEFAULT_TIMEZONE)}`);
}

type ValidityChoiceProps = {
  form: PromotionForm;
  window: ValidityWindow | null;
  /** The last day a promotion may be scheduled to start or end, 'YYYY-MM-DD'. */
  limits: { today: string; lastDay: string };
  error?: string;
  set: (patch: Partial<PromotionForm>) => void;
};

/**
 * "¿Hasta cuándo?" (marketing §4, step 2): chips that end at the closing time of the
 * distributor, not at midnight, and the sentence of what was chosen under them.
 */
export function ValidityChoice({ form, window, limits, error, set }: ValidityChoiceProps) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        ¿Hasta cuándo?
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {CHOICES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={form.validity === value}
            onClick={() => set({ validity: value })}
            className={CHIP_CLASS}
          >
            {label}
          </button>
        ))}
      </div>
      {form.validity === 'todayHours' && (
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
          <TextField
            label="Desde"
            name="fromTime"
            type="time"
            value={form.fromTime}
            onChange={(event) => set({ fromTime: event.target.value })}
          />
          <TextField
            label="Hasta"
            name="toTime"
            type="time"
            value={form.toTime}
            onChange={(event) => set({ toTime: event.target.value })}
          />
        </div>
      )}
      {form.validity === 'dates' && (
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
          <TextField
            label="Empieza"
            name="startDay"
            type="date"
            min={limits.today}
            max={limits.lastDay}
            value={form.startDay}
            onChange={(event) => set({ startDay: event.target.value })}
          />
          <TextField
            label="Termina"
            name="endDay"
            type="date"
            min={form.startDay || limits.today}
            max={limits.lastDay}
            value={form.endDay}
            onChange={(event) => set({ endDay: event.target.value })}
          />
        </div>
      )}
      {window && !error && (
        <p className="mt-2 text-[0.9375rem] font-semibold">{windowSentence(window)}</p>
      )}
      {error && <FieldError id={`${labelId}-error`}>{error}</FieldError>}
    </div>
  );
}
