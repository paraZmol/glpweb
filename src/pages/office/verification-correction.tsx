import { type FormEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { VerificationFields } from '@/components/founding/verification-fields';
import type { DistributorPrivateSettings } from '@/domain/tenancy/types';
import type { BusinessVerificationInput } from '@/domain/tenancy/verification-input';
import { correctVerificationData } from '@/features/tenancy/tenancy-actions';
import {
  useVerificationData,
  type VerificationErrors,
  verificationErrorsOf,
  verificationFormOf,
  validateVerification,
} from '@/features/tenancy/verification-form';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para guardar tus datos necesitas internet.';
const SAVED = 'Guardamos tus datos. Hornilla los va a revisar de nuevo.';

type FormProps = {
  distributorId: string;
  settings: DistributorPrivateSettings;
  onDone: (wasSaved: boolean) => void;
};

function CorrectionForm({ distributorId, settings, onDone }: FormProps) {
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<BusinessVerificationInput>(() =>
    verificationFormOf(settings),
  );
  const [errors, setErrors] = useState<VerificationErrors>({});
  useFocusFirstInvalid(formRef, errors);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems = validateVerification(values);
    setErrors(problems);
    if (Object.keys(problems).length > 0 || !isOnline) return;
    void run(async () => {
      try {
        await correctVerificationData(distributorId, values);
        onDone(true);
      } catch (error) {
        setErrors(verificationErrorsOf(error));
      }
    });
  };

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <VerificationFields
        values={values}
        errors={errors}
        onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
      />
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="ink"
          size="sm"
          loading={isRunning}
          loadingLabel="Guardando tus datos…"
          disabled={!isOnline}
        >
          Guardar mis datos
        </Button>
        <Button
          type="button"
          variant="line"
          size="sm"
          disabled={isRunning}
          onClick={() => onDone(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

type CorrectionProps = { distributorId: string; onCorrected?: () => void };

/**
 * The founder corrects the RUC, the legal name or the record number a platform admin sent back
 * (PLAN 2.11). Closed until asked for: the private data is read only when the form opens.
 * Saving marks the listing as corrected: `onCorrected` lets the office read its new state.
 */
export function VerificationCorrection({ distributorId, onCorrected }: CorrectionProps) {
  const [isOpen, setOpen] = useState(false);
  const settings = useVerificationData(isOpen ? distributorId : null);

  const close = (saved: boolean) => {
    setOpen(false);
    if (!saved) return;
    // A toast: the panel around this form is read again and would take an inline message away.
    toast.success(SAVED);
    onCorrected?.();
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="ink"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        Corregir mis datos
      </Button>
    );
  }
  if (settings.status === 'error' || (settings.status === 'ready' && settings.data === null)) {
    return (
      <InlineAlert tone="error">
        No pudimos cargar tus datos. Puede ser la conexión.{' '}
        <button type="button" className="font-bold underline" onClick={settings.reload}>
          Reintentar
        </button>
      </InlineAlert>
    );
  }
  if (settings.status !== 'ready' || settings.data === null) {
    return (
      <LoadingRegion label="Cargando tus datos" className="flex flex-col gap-3">
        <Bone className="h-12 rounded-lg" />
        <Bone className="h-12 rounded-lg" />
        <Bone className="h-12 rounded-lg" />
      </LoadingRegion>
    );
  }
  return <CorrectionForm distributorId={distributorId} settings={settings.data} onDone={close} />;
}
