import { useId } from 'react';
import { FieldError, TextField } from '@/components/common/text-field';

// Monday first, as a week is read in Peru; the stored numbers are 0 = Sunday … 6 = Saturday.
const DAYS = [
  { day: 1, short: 'Lun', name: 'Lunes' },
  { day: 2, short: 'Mar', name: 'Martes' },
  { day: 3, short: 'Mié', name: 'Miércoles' },
  { day: 4, short: 'Jue', name: 'Jueves' },
  { day: 5, short: 'Vie', name: 'Viernes' },
  { day: 6, short: 'Sáb', name: 'Sábado' },
  { day: 0, short: 'Dom', name: 'Domingo' },
] as const;

type ScheduleFieldsProps = {
  days: readonly number[];
  opensAt: string;
  closesAt: string;
  error?: string;
  onToggleDay: (day: number) => void;
  onChangeTime: (field: 'opensAt' | 'closesAt', value: string) => void;
};

/**
 * Opening hours of a distributor: the days as chips (never a dropdown) and one window of time
 * for all of them, which is what the public profile stores.
 */
export function ScheduleFields({
  days,
  opensAt,
  closesAt,
  error,
  onToggleDay,
  onChangeTime,
}: ScheduleFieldsProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-labelledby={labelId} aria-describedby={error ? errorId : undefined}>
        <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
          Días de atención
        </p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(({ day, short, name }) => (
            <button
              key={day}
              type="button"
              aria-pressed={days.includes(day)}
              aria-label={name}
              onClick={() => onToggleDay(day)}
              className="press min-h-11 min-w-12 rounded-full px-3 text-[0.9375rem] font-semibold inset-ring-[1.5px] inset-ring-border transition-colors motion-fast aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:inset-ring-foreground"
            >
              {short}
            </button>
          ))}
        </div>
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Abre a las"
          name="opensAt"
          type="time"
          value={opensAt}
          onChange={(event) => onChangeTime('opensAt', event.target.value)}
          aria-invalid={error ? true : undefined}
        />
        <TextField
          label="Cierra a las"
          name="closesAt"
          type="time"
          value={closesAt}
          onChange={(event) => onChangeTime('closesAt', event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </div>
    </div>
  );
}
