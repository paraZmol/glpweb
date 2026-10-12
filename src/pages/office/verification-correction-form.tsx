import { type FormEvent, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { VerificationFields } from '@/components/founding/verification-fields';
import type { DistributorPrivateSettings } from '@/domain/tenancy/types';
import type { BusinessVerificationInput } from '@/domain/tenancy/verification-input';
import { correctVerificationData } from '@/features/tenancy/tenancy-actions';
import {
  type VerificationErrors,
  verificationErrorsOf,
  verificationFormOf,
  validateVerification,
} from '@/features/tenancy/verification-form';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para guardar tus datos necesitas internet.';
// PLAN 5.4: the suspension (or the end of the plan) arrived with the form open.
const LEFT_UNSAVED =
  'Tu distribuidora pasó a solo lectura mientras corregías. Lo que escribiste sigue a la vista, pero no se guardó y ahora no se puede guardar.';

type CorrectionFormProps = {
  distributorId: string;
  settings: DistributorPrivateSettings;
  /** The distributor turned read-only with the form open. */
  readOnly: boolean;
  onDone: (wasSaved: boolean) => void;
};

/**
 * The three verification data as the founder corrects them (PLAN 2.11). On a read-only
 * distributor the fields keep what was typed and there is nothing to save.
 */
export function CorrectionForm({ distributorId, settings, readOnly, onDone }: CorrectionFormProps) {
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
    if (readOnly) return;
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
        disabled={readOnly}
        onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
      />
      {readOnly ? (
        <InlineAlert tone="info">{LEFT_UNSAVED}</InlineAlert>
      ) : (
        <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      )}
      <div className="flex flex-wrap gap-3">
        {!readOnly && (
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
        )}
        <Button
          type="button"
          variant="line"
          size="sm"
          disabled={isRunning}
          onClick={() => onDone(false)}
        >
          {readOnly ? 'Cerrar' : 'Cancelar'}
        </Button>
      </div>
    </form>
  );
}
