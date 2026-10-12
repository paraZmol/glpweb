import { LocateFixed } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { MapGap } from '@/components/common/map-gap';
import { FieldError, TextField } from '@/components/common/text-field';
import { ADDRESS_LINE_MAX_LENGTH } from '@/domain/tenancy/constants';
import { GEOLOCATION_FAILURE_TEXT } from '@/features/location/location-messages';
import {
  GeolocationFailure,
  type GeolocationFailureReason,
  requestCurrentPosition,
} from '@/lib/geolocation';
import { ICON_STROKE } from '@/lib/icons';
import { useAsyncAction } from '@/lib/use-async-action';
import { RadiusStepper } from './radius-stepper';
import type { StepProps } from './step-business';

const TYPED_DECIMALS = 5; // about one metre
// Said before the browser asks for the permission (tracking-pwa §1).
const WHY =
  'Si estás en la planta, tu celular puede decirnos dónde queda. Solo se usa para llenar estos dos campos.';
const COORDINATE_FIELD = { inputMode: 'text', autoComplete: 'off', spellCheck: false } as const;

/** Step 2 (PLAN 2.2): where the plant is and how far it delivers. The map arrives in phase 6. */
export function StepLocation({ form, errors, set }: StepProps) {
  const whyId = useId();
  const plantErrorId = useId();
  const { isRunning, run } = useAsyncAction();
  const [failure, setFailure] = useState<GeolocationFailureReason | null>(null);

  const locate = () =>
    void run(async () => {
      try {
        const point = await requestCurrentPosition();
        set('latitude', point.lat.toFixed(TYPED_DECIMALS));
        set('longitude', point.lng.toFixed(TYPED_DECIMALS));
        setFailure(null);
      } catch (error) {
        setFailure(error instanceof GeolocationFailure ? error.reason : 'unavailable');
      }
    });

  return (
    <>
      <div className="flex flex-col gap-3">
        <p id={whyId} className="text-[0.9375rem] text-muted-foreground">
          {WHY}
        </p>
        <Button
          type="button"
          variant="ink"
          className="self-start"
          aria-describedby={whyId}
          loading={isRunning}
          loadingLabel="Buscando tu ubicación…"
          onClick={locate}
        >
          <LocateFixed aria-hidden="true" strokeWidth={ICON_STROKE} />
          Usar mi ubicación
        </Button>
        {failure && <InlineAlert tone="info">{GEOLOCATION_FAILURE_TEXT[failure]}</InlineAlert>}
      </div>
      <div
        role="group"
        aria-label="Ubicación de la planta"
        aria-describedby={errors.plant ? plantErrorId : undefined}
      >
        <div className="grid grid-cols-2 gap-3">
          <TextField
            {...COORDINATE_FIELD}
            label="Latitud"
            name="latitude"
            placeholder="-12.0464"
            value={form.latitude}
            onChange={(event) => set('latitude', event.target.value)}
            aria-invalid={errors.plant ? true : undefined}
          />
          <TextField
            {...COORDINATE_FIELD}
            label="Longitud"
            name="longitude"
            placeholder="-77.0428"
            value={form.longitude}
            onChange={(event) => set('longitude', event.target.value)}
            aria-invalid={errors.plant ? true : undefined}
          />
        </div>
        {errors.plant && <FieldError id={plantErrorId}>{errors.plant}</FieldError>}
        <p className="mt-1.5 text-sm text-muted-foreground">
          Son los dos números que tu app de mapas muestra al mantener presionado un lugar. En el
          Perú los dos son negativos, por ejemplo -12.0464 y -77.0428.
        </p>
      </div>
      <TextField
        label="Dirección de la planta (opcional)"
        name="addressLine"
        autoComplete="street-address"
        maxLength={ADDRESS_LINE_MAX_LENGTH}
        value={form.addressLine}
        onChange={(event) => set('addressLine', event.target.value)}
        error={errors.addressLine}
        hint="Es pública: ayuda a tus clientes a reconocerte."
      />
      <RadiusStepper
        value={form.coverageRadiusKm}
        onChange={(radiusKm) => set('coverageRadiusKm', radiusKm)}
        error={errors.coverageRadiusKm}
      />
      <div>
        <MapGap className="h-44" />
        <p className="mt-2 text-sm text-muted-foreground">
          Aquí vas a marcar la planta y ver el círculo de cobertura sobre el mapa. Llega en una
          próxima versión; por ahora basta con los datos de arriba.
        </p>
      </div>
    </>
  );
}
