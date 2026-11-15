import { type FormEvent, useEffect, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextField } from '@/components/common/text-field';
import { VehicleKindChoice } from '@/components/vehicles/vehicle-kind';
import { VEHICLE_NAME_MAX_LENGTH } from '@/domain/vehicles/constants';
import { plateInUse, type Vehicle } from '@/domain/vehicles/vehicle';
import { normalizePlate } from '@/domain/vehicles/vehicle-input';
import { addVehicle, editVehicle } from '@/features/vehicles/vehicle-actions';
import {
  emptyVehicleForm,
  readVehicleForm,
  type VehicleForm,
  type VehicleFormErrors,
  vehicleFormErrorsOf,
  vehicleFormOf,
} from '@/features/vehicles/vehicle-form';
import { PLATE_IN_USE_WARNING } from '@/features/vehicles/vehicle-messages';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para guardar el vehículo necesitas internet.';

type VehicleFormPanelProps = {
  distributorId: string;
  /** The vehicle to edit, or null to add one. */
  vehicle: Vehicle | null;
  /** Every vehicle, to warn about a plate already in use (the rules cannot, PLAN §9). */
  vehicles: readonly Vehicle[];
  onSaved: (message: string) => void;
  onCancel: () => void;
};

/** Add or edit one vehicle (PLAN 3.3); a new capacity applies from the next shift on. */
export function VehicleFormPanel(props: VehicleFormPanelProps) {
  const { distributorId, vehicles, onSaved, onCancel } = props;
  const [vehicle] = useState(props.vehicle);
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(() => (vehicle ? vehicleFormOf(vehicle) : emptyVehicleForm()));
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  useFocusFirstInvalid(formRef, errors);
  const isNew = vehicle === null;
  const isPlateRepeated = plateInUse(vehicles, normalizePlate(form.plate), vehicle?.id ?? null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const set = <F extends keyof VehicleForm>(field: F, value: VehicleForm[F]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors(({ [field]: _field, form: _form, ...rest }) => rest);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const read = readVehicleForm(form);
    if (!read.ok) return setErrors(read.errors);
    if (!isOnline) return undefined;
    void run(async () => {
      try {
        if (vehicle) await editVehicle(distributorId, vehicle, read.input);
        else await addVehicle(distributorId, read.input);
        onSaved(
          isNew
            ? `Añadimos ${read.input.name.trim()}.`
            : `Guardamos los cambios de ${vehicle.name}.`,
        );
      } catch (error) {
        setErrors(vehicleFormErrorsOf(error));
      }
    });
    return undefined;
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      aria-labelledby="vehicle-form-title"
      className="flex scroll-mt-[calc(var(--top-inset)+1rem)] flex-col gap-6"
    >
      <div>
        <h2 id="vehicle-form-title" className="text-xl font-extrabold">
          {isNew ? 'Nuevo vehículo.' : `Editar ${vehicle.name}.`}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {isNew
            ? 'Queda en uso apenas lo guardes.'
            : 'Una capacidad nueva vale desde la próxima jornada; las ya aprobadas conservan la suya.'}
        </p>
      </div>
      <VehicleKindChoice
        value={form.kind}
        error={errors.kind}
        onChange={(kind) => set('kind', kind)}
      />
      <TextField
        label="Nombre"
        name="vehicleName"
        autoComplete="off"
        maxLength={VEHICLE_NAME_MAX_LENGTH}
        placeholder="Por ejemplo, Moto roja"
        hint="Como lo llaman en tu planta."
        value={form.name}
        error={errors.name}
        onChange={(event) => set('name', event.target.value)}
      />
      <TextField
        label="Placa (opcional)"
        name="plate"
        autoComplete="off"
        autoCapitalize="characters"
        placeholder="ABC-123"
        hint="Déjala vacía si no tiene placa."
        value={form.plate}
        error={errors.plate}
        onChange={(event) => set('plate', event.target.value)}
      />
      {isPlateRepeated && <InlineAlert tone="info">{PLATE_IN_USE_WARNING}</InlineAlert>}
      <TextField
        label="¿Cuántos balones lleva?"
        name="capacity"
        inputMode="numeric"
        autoComplete="off"
        className="max-w-60"
        hint="En total, de cualquier peso."
        value={form.capacity}
        error={errors.capacity}
        onChange={(event) => set('capacity', event.target.value)}
      />
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isRunning} loadingLabel="Guardando…" disabled={!isOnline}>
          {isNew ? 'Guardar vehículo' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="line" disabled={isRunning} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
