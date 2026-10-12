import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { useVerificationData } from '@/features/tenancy/verification-form';
import { CorrectionForm } from './verification-correction-form';

const SAVED = 'Guardamos tus datos. Hornilla los va a revisar de nuevo.';
// PLAN 5.4: a read-only distributor takes no correction; the rules would refuse it.
const NOT_NOW = 'Mientras tu distribuidora esté en solo lectura no se pueden corregir estos datos.';

type CorrectionProps = {
  distributorId: string;
  /** Read-only distributor: the form is not offered; one left open stops taking changes. */
  readOnly?: boolean;
  onCorrected?: () => void;
};

/**
 * The founder corrects the RUC, the legal name or the record number a platform admin sent back
 * (PLAN 2.11). Closed until asked for: the private data is read only when the form opens.
 * Saving marks the listing as corrected: `onCorrected` lets the office read its new state.
 */
export function VerificationCorrection(props: CorrectionProps) {
  const { distributorId, readOnly = false, onCorrected } = props;
  const [isOpen, setOpen] = useState(false);
  const settings = useVerificationData(isOpen ? distributorId : null);

  const close = (saved: boolean) => {
    setOpen(false);
    if (!saved) return;
    // A toast: the panel around this form is read again and would take an inline message away.
    toast.success(SAVED);
    onCorrected?.();
  };

  if (!isOpen && readOnly) return <p className="text-muted-foreground">{NOT_NOW}</p>;
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
  return (
    <CorrectionForm
      distributorId={distributorId}
      settings={settings.data}
      readOnly={readOnly}
      onDone={close}
    />
  );
}
