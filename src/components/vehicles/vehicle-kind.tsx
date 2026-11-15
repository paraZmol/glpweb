import { Bike, type LucideIcon, Motorbike, Truck } from 'lucide-react';
import { useId } from 'react';
import { FieldError } from '@/components/common/text-field';
import { VEHICLE_KINDS, type VehicleKind } from '@/domain/vehicles/vehicle';
import { VEHICLE_KIND_LABELS } from '@/features/vehicles/vehicle-messages';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

export const VEHICLE_KIND_ICONS: Record<VehicleKind, LucideIcon> = {
  motorcycle: Motorbike,
  tricycle: Bike,
  truck: Truck,
};

/** The kind drawn in a tile: one glyph of the single icon family, never a photo. */
export function VehicleKindTile({
  kind,
  isMuted = false,
}: {
  kind: VehicleKind;
  isMuted?: boolean;
}) {
  const Icon = VEHICLE_KIND_ICONS[kind];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-14 shrink-0 place-items-center rounded-lg bg-muted text-foreground',
        isMuted && 'text-muted-foreground',
      )}
    >
      <Icon className="size-7" strokeWidth={ICON_STROKE} />
    </span>
  );
}

type VehicleKindChoiceProps = {
  value: VehicleKind;
  error?: string;
  onChange: (kind: VehicleKind) => void;
};

/** Three cards instead of a drop-down (design-craft §2): the choice is raised and inked. */
export function VehicleKindChoice({ value, error, onChange }: VehicleKindChoiceProps) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        Tipo de vehículo
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-3 gap-2">
        {VEHICLE_KINDS.map((kind) => {
          const Icon = VEHICLE_KIND_ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => onChange(kind)}
              className={cn(
                'press flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center',
                'text-[0.875rem] leading-tight font-bold motion-instant inset-ring-[1.5px] inset-ring-input',
                'aria-checked:bg-foreground aria-checked:text-background aria-checked:inset-ring-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-6" strokeWidth={ICON_STROKE} />
              {VEHICLE_KIND_LABELS[kind]}
            </button>
          );
        })}
      </div>
      {error && <FieldError id={`${labelId}-error`}>{error}</FieldError>}
    </div>
  );
}
